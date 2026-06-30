# backend/python/app.py

import sys
import json
import argparse
import re
from medical_summary import MedicalSummarizer
import os
from dotenv import load_dotenv
import traceback

# Load environment: optional utils/.env first, then backend/.env (overrides)
_backend_dir = os.path.join(os.path.dirname(__file__), '..')
load_dotenv(os.path.join(_backend_dir, 'utils', '.env'))
load_dotenv(os.path.join(_backend_dir, '.env'), override=True)

# Database configuration from environment variables
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD') or os.getenv('DB_PASS', ''),
    'database': os.getenv('DB_NAME', 'medivault'),
    'port': int(os.getenv('DB_PORT', '3306'))
}

GROQ_API_KEY = os.getenv('GROQ_API_KEY', '').strip()
DEFAULT_PATIENT_ID = int(os.getenv('DEFAULT_PATIENT_ID', '1'))

_canned_path = os.path.join(os.path.dirname(__file__), 'canned_responses.json')
try:
    with open(_canned_path, 'r', encoding='utf-8') as _f:
        CANNED_RAG_ANSWERS = json.load(_f)
except (FileNotFoundError, json.JSONDecodeError) as _e:
    print(f"[WARN] Could not load canned_responses.json: {_e}", file=sys.stderr)
    CANNED_RAG_ANSWERS = {}

def get_canned_rag_response(query: str):
    if not query:
        return None
    normalized = re.sub(r"[?!.]+$", "", query.strip().lower()).strip()
    return CANNED_RAG_ANSWERS.get(normalized)


def validate_config():
    """Validate that all required configuration is present"""
    errors = []
    
    if not GROQ_API_KEY:
        errors.append("GROQ_API_KEY is missing in .env file")
    
    if not DB_CONFIG['database']:
        errors.append("DB_NAME is missing in .env file")
    
    if errors:
        return False, errors
    
    return True, []

def resolve_patient_id(args) -> int:
    """
    Resolve patient id from (in order):
    - CLI --patient_id
    - env PATIENT_ID
    """
    if getattr(args, "patient_id", None) is not None:
        return int(args.patient_id)

    env_pid = (os.getenv("PATIENT_ID") or "").strip()
    if env_pid:
        try:
            return int(env_pid)
        except ValueError:
            raise ValueError("PATIENT_ID must be an integer.")

    if DEFAULT_PATIENT_ID:
        print(f"[DEBUG] No patient_id provided; defaulting to patient ID {DEFAULT_PATIENT_ID}", file=sys.stderr)
        return DEFAULT_PATIENT_ID

    raise ValueError("patient_id is required (provide env PATIENT_ID or CLI --patient_id).")

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Generate patient medical summary using AI')
    parser.add_argument('--patient_id', '--patient-id', dest='patient_id', type=int, required=False, help='Patient ID to generate summary for')
    parser.add_argument('--force_refresh', type=int, default=0, help='Force full refresh (1) or incremental update (0)')
    parser.add_argument('--query', type=str, default='', help='Optional patient-history question for RAG mode')
    parser.add_argument('--top_k', '--top-k', dest='top_k', type=int, default=5, help='Number of chunks to retrieve in RAG mode')
    
    args = parser.parse_args()
    
    try:
        # Validate configuration
        is_valid, errors = validate_config()
        if not is_valid:
            error_result = {
                'success': False,
                'error': 'Configuration Error',
                'message': 'Missing required configuration',
                'details': errors
            }
            print(json.dumps(error_result))
            sys.exit(1)

        patient_id = resolve_patient_id(args)
        
        # Log debug info to stderr (won't interfere with JSON output)
        print(f"[DEBUG] Processing patient ID: {patient_id}", file=sys.stderr)
        print(f"[DEBUG] Force refresh: {bool(args.force_refresh)}", file=sys.stderr)
        print(f"[DEBUG] Database: {DB_CONFIG['database']}", file=sys.stderr)
        
        # Initialize summarizer
        summarizer = MedicalSummarizer(DB_CONFIG, GROQ_API_KEY)

        if args.query and args.query.strip():
            canned_answer = get_canned_rag_response(args.query)
            if canned_answer:
                result = {
                    "success": True,
                    "patient_id": patient_id,
                    "query": args.query,
                    "model": "local-canned",
                    "answer": canned_answer,
                    "retrieved_chunks": [],
                    "message": "Canned response for known query."
                }
            else:
                result = summarizer.answer_query_with_rag(
                    patient_id=patient_id,
                    query=args.query,
                    top_k=max(1, args.top_k)
                )
        else:
            # Generate summary
            result = summarizer.get_summary(
                patient_id=patient_id,
                force_refresh=bool(args.force_refresh)
            )
        
        # Output as JSON to stdout (this will be captured by Node.js)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
        # Exit with appropriate code
        sys.exit(0 if result.get('success') else 1)
        
    except KeyboardInterrupt:
        error_result = {
            'success': False,
            'error': 'Interrupted',
            'message': 'Process was interrupted by user'
        }
        print(json.dumps(error_result))
        sys.exit(1)
        
    except Exception as e:
        # Log full traceback to stderr for debugging
        print(f"[ERROR] Exception occurred:", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        
        # Send clean error to stdout as JSON
        error_result = {
            'success': False,
            'error': type(e).__name__,
            'message': str(e),
            'traceback': traceback.format_exc() if os.getenv('DEBUG') == 'true' else None
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()