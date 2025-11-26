# backend/python/app.py

import sys
import json
import argparse
from medical_summary import MedicalSummarizer
import os
from dotenv import load_dotenv
import traceback

# Load environment variables from backend/utils/.env
env_path = os.path.join(os.path.dirname(__file__), '..', 'utils', '.env')
load_dotenv(env_path)

# Database configuration from environment variables
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', '0509'),
    'database': os.getenv('DB_NAME', 'medivault'),
    'port': int(os.getenv('DB_PORT', '3306'))
}

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'AIzaSyDQOnsxEPt5GmZd-1rNOvnKyA6Ryym7LaI')

def validate_config():
    """Validate that all required configuration is present"""
    errors = []
    
    if not GEMINI_API_KEY:
        errors.append("GEMINI_API_KEY is missing in .env file")
    
    if not DB_CONFIG['database']:
        errors.append("DB_NAME is missing in .env file")
    
    if errors:
        return False, errors
    
    return True, []

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Generate patient medical summary using AI')
    parser.add_argument('--patient_id', type=int, required=True, help='Patient ID to generate summary for')
    parser.add_argument('--force_refresh', type=int, default=0, help='Force full refresh (1) or incremental update (0)')
    
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
        
        # Log debug info to stderr (won't interfere with JSON output)
        print(f"[DEBUG] Processing patient ID: {args.patient_id}", file=sys.stderr)
        print(f"[DEBUG] Force refresh: {bool(args.force_refresh)}", file=sys.stderr)
        print(f"[DEBUG] Database: {DB_CONFIG['database']}", file=sys.stderr)
        
        # Initialize summarizer
        summarizer = MedicalSummarizer(DB_CONFIG, GEMINI_API_KEY)
        
        # Generate summary
        result = summarizer.get_summary(
            patient_id=args.patient_id,
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