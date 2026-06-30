# backend/python/medical_summary.py

try:
    import mysql.connector
except ModuleNotFoundError as e:
    raise ModuleNotFoundError(
        "Missing dependency for MySQL. Install it with:\n"
        "  python -m pip install mysql-connector-python\n"
        "Then re-run this script."
    ) from e
from datetime import datetime, date
import json
import os
from typing import Dict, List, Optional, Tuple
import re
import ssl
import urllib.error
import urllib.request

# Default from Groq docs: strong general/chat quality and large context for RAG.
# Override with env GROQ_MODEL if needed.
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

class MedicalSummarizer:
    GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, db_config, groq_api_key: str, groq_model: Optional[str] = None):
        self.db_config = db_config
        self.groq_api_key = groq_api_key or ""
        self.groq_model = (groq_model or os.getenv("GROQ_MODEL") or DEFAULT_GROQ_MODEL).strip()
        self.conn = None
        self.cursor = None

    def _llm_complete(self, user_prompt: str, system_prompt: Optional[str] = None) -> str:
        if not self.groq_api_key:
            raise RuntimeError("GROQ_API_KEY is not configured.")
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})
        payload = {
            "model": self.groq_model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 2048,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.GROQ_CHAT_URL,
            data=data,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json",
            },
        )
        context = ssl.create_default_context()
        try:
            with urllib.request.urlopen(req, timeout=120, context=context) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Groq API error {e.code}: {err_body}") from e
        except urllib.error.URLError as e:
            if isinstance(e.reason, ssl.SSLCertVerificationError):
                # Retry once with an unverified SSL context for development environments
                try:
                    with urllib.request.urlopen(req, timeout=120, context=ssl._create_unverified_context()) as resp:
                        body = json.loads(resp.read().decode("utf-8"))
                except Exception:
                    raise RuntimeError(
                        "Groq API SSL verification failed. Install certifi or configure your system certificates."
                    ) from e
            raise

        choices = body.get("choices") or []
        if not choices:
            raise RuntimeError(f"Groq API returned no choices: {body}")
        content = (choices[0].get("message") or {}).get("content") or ""
        return content.strip()
    
    def connect_db(self):
        """Establish database connection"""
        try:
            self.conn = mysql.connector.connect(**self.db_config)
            self.cursor = self.conn.cursor(dictionary=True)
        except mysql.connector.Error as err:
            raise Exception(f"Database error: {err}")
    
    def close_db(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
    
    def ensure_summaries_table(self):
        """Create summaries table if not exists"""
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS patient_summaries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT NOT NULL,
            summary_text TEXT NOT NULL,
            summary_date DATE NOT NULL,
            last_record_date DATE NOT NULL,
            data_included JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_patient_summary (patient_id, summary_date)
        );
        """
        self.cursor.execute(create_table_sql)
        self.conn.commit()
    
    def get_last_summary(self, patient_id: int) -> Optional[Dict]:
        """Get the most recent summary for a patient"""
        query = """
        SELECT * FROM patient_summaries 
        WHERE patient_id = %s 
        ORDER BY summary_date DESC 
        LIMIT 1
        """
        self.cursor.execute(query, (patient_id,))
        return self.cursor.fetchone()
    
    def get_new_data_since(self, patient_id: int, since_date: str) -> Dict:
        """Fetch only new data added after the last summary date"""
        data = {}
        
        # New medical records
        self.cursor.execute("""
            SELECT * FROM medical_records 
            WHERE patient_id = %s AND record_date > %s
            ORDER BY record_date DESC
        """, (patient_id, since_date))
        data['medical_records'] = self.cursor.fetchall()
        
        # New appointments
        self.cursor.execute("""
            SELECT a.*, u.name as doctor_name 
            FROM appointments a
            LEFT JOIN users u ON a.doctor_id = u.id
            WHERE a.patient_id = %s AND a.appointment_date > %s
            ORDER BY a.appointment_date DESC
        """, (patient_id, since_date))
        data['appointments'] = self.cursor.fetchall()
        
        # New prescriptions
        self.cursor.execute("""
            SELECT p.*, u.name as doctor_name 
            FROM prescriptions p
            LEFT JOIN users u ON p.doctor_id = u.id
            WHERE p.patient_id = %s AND p.prescribed_date > %s
            ORDER BY p.prescribed_date DESC
        """, (patient_id, since_date))
        data['prescriptions'] = self.cursor.fetchall()
        
        # New vital signs
        self.cursor.execute("""
            SELECT * FROM vital_signs 
            WHERE patient_id = %s AND recorded_date > %s
            ORDER BY recorded_date DESC
        """, (patient_id, since_date))
        data['vital_signs'] = self.cursor.fetchall()
        
        return data
    
    def get_all_patient_data(self, patient_id: int) -> Dict:
        """Fetch all patient data"""
        data = {}
        
        # User info
        self.cursor.execute("SELECT * FROM users WHERE id = %s", (patient_id,))
        data['user_info'] = self.cursor.fetchone()
        
        if not data['user_info']:
            raise Exception("Patient not found")
        
        # All medical records
        self.cursor.execute("""
            SELECT * FROM medical_records 
            WHERE patient_id = %s 
            ORDER BY record_date DESC
        """, (patient_id,))
        data['medical_records'] = self.cursor.fetchall()
        
        # All appointments
        self.cursor.execute("""
            SELECT a.*, u.name as doctor_name 
            FROM appointments a
            LEFT JOIN users u ON a.doctor_id = u.id
            WHERE a.patient_id = %s 
            ORDER BY a.appointment_date DESC
        """, (patient_id,))
        data['appointments'] = self.cursor.fetchall()
        
        # All prescriptions
        self.cursor.execute("""
            SELECT p.*, u.name as doctor_name 
            FROM prescriptions p
            LEFT JOIN users u ON p.doctor_id = u.id
            WHERE p.patient_id = %s 
            ORDER BY p.prescribed_date DESC
        """, (patient_id,))
        data['prescriptions'] = self.cursor.fetchall()
        
        # All vital signs
        self.cursor.execute("""
            SELECT * FROM vital_signs 
            WHERE patient_id = %s 
            ORDER BY recorded_date DESC
        """, (patient_id,))
        data['vital_signs'] = self.cursor.fetchall()
        
        return data
    
    def format_data_for_prompt(self, data: Dict, is_incremental: bool = False) -> str:
        """Format medical data into readable text for the LLM"""
        prompt_parts = []
        
        if not is_incremental and 'user_info' in data:
            user = data['user_info']
            prompt_parts.append(f"""
Patient Information:
- Name: {user.get('name', 'N/A')}
- Age: {self.calculate_age(user.get('date_of_birth'))}
- Blood Group: {user.get('blood_group', 'N/A')}
- Phone: {user.get('phone', 'N/A')}
""")
        
        if data.get('medical_records'):
            prompt_parts.append("\nMedical Records:")
            for record in data['medical_records'][:10]:  # Limit to recent 10
                prompt_parts.append(f"- [{record['record_date']}] {record['type']}: {record['title']}")
                if record.get('notes'):
                    prompt_parts.append(f"  Notes: {record['notes']}")
        
        if data.get('appointments'):
            prompt_parts.append("\nAppointments:")
            for apt in data['appointments'][:10]:
                doctor_name = apt.get('doctor_name', 'Unknown')
                prompt_parts.append(f"- [{apt['appointment_date']}] Dr. {doctor_name} - Status: {apt['status']}")
                if apt.get('reason'):
                    prompt_parts.append(f"  Reason: {apt['reason']}")
        
        if data.get('prescriptions'):
            prompt_parts.append("\nPrescriptions:")
            for rx in data['prescriptions'][:15]:
                doctor_name = rx.get('doctor_name', 'Unknown')
                prompt_parts.append(f"- [{rx['prescribed_date']}] {rx['medicine_name']} ({rx['dosage']}) - Dr. {doctor_name}")
        
        if data.get('vital_signs'):
            prompt_parts.append("\nVital Signs (Recent):")
            for vital in data['vital_signs'][:10]:
                prompt_parts.append(f"- [{vital['recorded_date']}] BP: {vital.get('blood_pressure', 'N/A')}, "
                                  f"HR: {vital.get('heart_rate', 'N/A')}, "
                                  f"Temp: {vital.get('temperature', 'N/A')}°F, "
                                  f"Weight: {vital.get('weight', 'N/A')}kg")
        
        return "\n".join(prompt_parts)

    def _to_text(self, value) -> str:
        """Safely convert any value to text."""
        if value is None:
            return "N/A"
        return str(value)

    def _tokenize(self, text: str) -> set:
        """Simple tokenizer used for lightweight retrieval."""
        if not text:
            return set()
        return set(re.findall(r"[a-zA-Z0-9]+", text.lower()))

    def _safe_date(self, value) -> Optional[date]:
        """Parse MySQL DATE / DATETIME / string into date."""
        if value is None:
            return None
        if isinstance(value, date):
            # note: datetime is also a date
            return value if not isinstance(value, datetime) else value.date()
        s = str(value).strip()
        # most common formats in this project: YYYY-MM-DD and ISO-like
        try:
            return datetime.fromisoformat(s.replace("Z", "")).date()
        except Exception:
            pass
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d").date()
        except Exception:
            return None

    def _days_ago(self, d: Optional[date]) -> Optional[int]:
        if not d:
            return None
        try:
            return max(0, (datetime.today().date() - d).days)
        except Exception:
            return None

    def _source_weight(self, source: str) -> float:
        # Heuristic weights: vitals and prescriptions are often most query-relevant.
        weights = {
            "patient_summary": 1.05,
            "vital_signs": 1.30,
            "prescriptions": 1.20,
            "medical_records": 1.10,
            "appointments": 0.95,
            "user_info": 0.70,
        }
        return float(weights.get(source, 1.0))

    def _intent_sources(self, query: str) -> set:
        """Infer which sources are likely relevant for the query."""
        q = (query or "").lower()
        sources = set()
        if any(k in q for k in ["bp", "blood pressure", "heart rate", "pulse", "temperature", "fever", "weight", "spo2", "oxygen"]):
            sources.add("vital_signs")
        if any(k in q for k in ["medicine", "medication", "drug", "tablet", "capsule", "dose", "dosage", "prescription"]):
            sources.add("prescriptions")
        if any(k in q for k in ["appointment", "visit", "consult", "schedule", "when did i see", "doctor visit"]):
            sources.add("appointments")
        if any(k in q for k in ["report", "lab", "scan", "imaging", "record", "document", "file", "diagnosis"]):
            sources.add("medical_records")
        if any(k in q for k in ["age", "blood group", "phone", "contact", "address", "name"]):
            sources.add("user_info")
        return sources

    def _get_latest_summary_text(self, patient_id: int) -> Optional[str]:
        """Fetch latest cached summary (if present)."""
        try:
            self.ensure_summaries_table()
            last = self.get_last_summary(patient_id)
            if not last:
                return None
            txt = (last.get("summary_text") or "").strip()
            return txt or None
        except Exception:
            return None

    def _build_patient_history_chunks(self, data: Dict) -> List[Dict]:
        """Convert patient history into small retrievable chunks."""
        chunks = []
        chunk_id = 1

        user = data.get('user_info')
        if user:
            user_text = (
                "Patient profile:\n"
                f"- Name: {self._to_text(user.get('name'))}\n"
                f"- Age: {self.calculate_age(user.get('date_of_birth'))}\n"
                f"- Blood Group: {self._to_text(user.get('blood_group'))}\n"
                f"- Phone: {self._to_text(user.get('phone'))}\n"
                f"- Emergency contact: {self._to_text(user.get('emergency_contact'))}"
            )
            chunks.append({
                "chunk_id": chunk_id,
                "source": "user_info",
                "text": user_text,
                "date": None
            })
            chunk_id += 1

        for record in data.get('medical_records', []):
            rec_date = self._safe_date(record.get("record_date"))
            record_text = (
                "Medical record:\n"
                f"- Date: {self._to_text(record.get('record_date'))}\n"
                f"- Type: {self._to_text(record.get('type'))}\n"
                f"- Title: {self._to_text(record.get('title'))}\n"
                f"- Notes: {self._to_text(record.get('notes'))}"
            )
            chunks.append({
                "chunk_id": chunk_id,
                "source": "medical_records",
                "text": record_text,
                "date": rec_date
            })
            chunk_id += 1

        for apt in data.get('appointments', []):
            apt_date = self._safe_date(apt.get("appointment_date"))
            apt_text = (
                "Appointment:\n"
                f"- Date: {self._to_text(apt.get('appointment_date'))}\n"
                f"- Time: {self._to_text(apt.get('appointment_time'))}\n"
                f"- Doctor: {self._to_text(apt.get('doctor_name'))}\n"
                f"- Status: {self._to_text(apt.get('status'))}\n"
                f"- Reason: {self._to_text(apt.get('reason'))}"
            )
            chunks.append({
                "chunk_id": chunk_id,
                "source": "appointments",
                "text": apt_text,
                "date": apt_date
            })
            chunk_id += 1

        for rx in data.get('prescriptions', []):
            rx_date = self._safe_date(rx.get("prescribed_date"))
            rx_text = (
                "Prescription:\n"
                f"- Date: {self._to_text(rx.get('prescribed_date'))}\n"
                f"- Medicine: {self._to_text(rx.get('medicine_name'))}\n"
                f"- Dosage: {self._to_text(rx.get('dosage'))}\n"
                f"- Duration: {self._to_text(rx.get('duration'))}\n"
                f"- Instructions: {self._to_text(rx.get('instructions'))}\n"
                f"- Prescribing doctor: {self._to_text(rx.get('doctor_name'))}"
            )
            chunks.append({
                "chunk_id": chunk_id,
                "source": "prescriptions",
                "text": rx_text,
                "date": rx_date
            })
            chunk_id += 1

        for vital in data.get('vital_signs', []):
            v_date = self._safe_date(vital.get("recorded_date"))
            vital_text = (
                "Vital signs:\n"
                f"- Date: {self._to_text(vital.get('recorded_date'))}\n"
                f"- Blood pressure: {self._to_text(vital.get('blood_pressure'))}\n"
                f"- Heart rate: {self._to_text(vital.get('heart_rate'))}\n"
                f"- Temperature (F): {self._to_text(vital.get('temperature'))}\n"
                f"- Weight (kg): {self._to_text(vital.get('weight'))}\n"
                f"- Notes: {self._to_text(vital.get('notes'))}"
            )
            chunks.append({
                "chunk_id": chunk_id,
                "source": "vital_signs",
                "text": vital_text,
                "date": v_date
            })
            chunk_id += 1

        return chunks

    def _score_chunk(self, chunk: Dict, query: str, query_tokens: set) -> float:
        text = chunk.get("text") or ""
        chunk_tokens = self._tokenize(text)
        overlap = len(query_tokens.intersection(chunk_tokens))

        # basic lexical score: overlap normalized by chunk length
        denom = max(8, len(chunk_tokens))
        lexical = overlap / float(denom)

        # phrase bonus (helps medicine names / multiword terms)
        q = (query or "").strip().lower()
        phrase_bonus = 0.0
        if len(q) >= 4 and q in text.lower():
            phrase_bonus = 0.15

        # source weight
        source = chunk.get("source") or ""
        w_source = self._source_weight(source)

        # recency boost if date is present
        d = chunk.get("date")
        days = self._days_ago(d)
        # Within ~30 days gets a noticeable boost; older fades smoothly.
        recency = 0.0 if days is None else (1.0 / (1.0 + (days / 30.0)))

        return (lexical + phrase_bonus) * w_source + (0.05 * recency)

    def _retrieve_relevant_chunks(self, chunks: List[Dict], query: str, top_k: int = 5) -> List[Dict]:
        """Improved retrieval: weighted lexical overlap + phrase + recency + intent coverage."""
        query_tokens = self._tokenize(query)
        if not chunks:
            return []

        scored: List[Tuple[float, Dict]] = []
        for chunk in chunks:
            score = self._score_chunk(chunk, query=query, query_tokens=query_tokens)
            scored.append((score, chunk))

        scored.sort(key=lambda item: item[0], reverse=True)
        ranked = [chunk for _, chunk in scored]

        # If query suggests certain sources, ensure at least one from each (if available)
        intent_sources = self._intent_sources(query)
        selected: List[Dict] = []
        picked_ids = set()

        def pick_first_where(pred):
            for c in ranked:
                if c.get("chunk_id") in picked_ids:
                    continue
                if pred(c):
                    picked_ids.add(c.get("chunk_id"))
                    selected.append(c)
                    return True
            return False

        for src in intent_sources:
            pick_first_where(lambda c, s=src: (c.get("source") == s))

        # Fill remaining by overall score
        for c in ranked:
            if len(selected) >= top_k:
                break
            cid = c.get("chunk_id")
            if cid in picked_ids:
                continue
            picked_ids.add(cid)
            selected.append(c)

        # Fallback: top_k first chunks (stable) if scoring was degenerate
        if not selected:
            return chunks[:top_k]
        return selected[:top_k]

    def answer_query_with_rag(self, patient_id: int, query: str, top_k: int = 5) -> Dict:
        """Basic RAG: retrieve patient-history chunks and answer grounded query."""
        if not query or not query.strip():
            return {
                "success": False,
                "message": "Query cannot be empty."
            }

        try:
            self.connect_db()
            data = self.get_all_patient_data(patient_id)
            chunks = self._build_patient_history_chunks(data)

            # Add cached longitudinal summary as an additional chunk (if available).
            summary_text = self._get_latest_summary_text(patient_id)
            if summary_text:
                chunks.insert(0, {
                    "chunk_id": 0,
                    "source": "patient_summary",
                    "text": f"Patient summary (cached):\n{summary_text}",
                    "date": None
                })
            retrieved_chunks = self._retrieve_relevant_chunks(chunks, query=query, top_k=top_k)

            context = "\n".join(
                [
                    f"[Chunk {item['chunk_id']} | {item['source']}] {item['text']}"
                    for item in retrieved_chunks
                ]
            )

            rag_prompt = f"""
You are a clinical assistant. Answer the user's question ONLY from the retrieved patient history context.
If the context is insufficient, clearly say what is missing and do not hallucinate.

User Question:
{query}

Retrieved Patient Context:
{context}

Return a concise response in 4 parts:
1) Direct Answer
2) Evidence from context (mention chunk IDs)
3) Safety Note (if medically sensitive)
4) Follow-up suggestion (if needed)
"""
            answer_text = self._llm_complete(
                rag_prompt,
                system_prompt="You answer strictly from the provided context. You are not a substitute for a clinician.",
            )

            return {
                "success": True,
                "patient_id": patient_id,
                "query": query,
                "model": self.groq_model,
                "answer": answer_text,
                "retrieved_chunks": retrieved_chunks,
                "message": "RAG response generated successfully."
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to generate RAG response."
            }
        finally:
            self.close_db()
    
    def calculate_age(self, dob):
        """Calculate age from date of birth"""
        if not dob:
            return "N/A"
        today = datetime.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    
    def generate_full_summary(self, patient_id: int) -> str:
        """Generate complete summary from all patient data"""
        data = self.get_all_patient_data(patient_id)
        formatted_data = self.format_data_for_prompt(data, is_incremental=False)
        
        prompt = f"""
You are a medical AI assistant. Analyze the following patient's medical history and provide a comprehensive summary.

{formatted_data}

Please provide:
1. **Patient Overview**: Key demographics and basic info
2. **Medical History Summary**: Major diagnoses, conditions, and treatments
3. **Recent Activities**: Latest appointments, prescriptions, and vital signs trends
4. **Health Concerns**: Any patterns or concerns identified
5. **Recommendations**: Suggested follow-ups or monitoring

Keep the summary concise but informative, suitable for quick doctor review.
"""
        
        return self._llm_complete(
            prompt,
            system_prompt="You are a medical documentation assistant. Produce clear summaries for clinician review, not patient diagnosis.",
        )
    
    def generate_incremental_summary(self, patient_id: int, last_summary: str, new_data: Dict) -> str:
        """Update existing summary with new data"""
        formatted_new_data = self.format_data_for_prompt(new_data, is_incremental=True)
        
        prompt = f"""
You are a medical AI assistant. Update the following patient summary with new medical data.

**PREVIOUS SUMMARY:**
{last_summary}

**NEW DATA SINCE LAST SUMMARY:**
{formatted_new_data}

Please provide an UPDATED summary that:
1. Integrates the new information seamlessly
2. Maintains the overall structure
3. Highlights what's new or changed
4. Keeps it concise while being comprehensive
"""
        
        return self._llm_complete(
            prompt,
            system_prompt="You are a medical documentation assistant updating a clinical summary from new data only.",
        )
    
    def save_summary(self, patient_id: int, summary: str, last_record_date: str, data_stats: Dict):
        """Save summary to database"""
        query = """
        INSERT INTO patient_summaries 
        (patient_id, summary_text, summary_date, last_record_date, data_included)
        VALUES (%s, %s, %s, %s, %s)
        """
        
        values = (
            patient_id,
            summary,
            datetime.now().date(),
            last_record_date,
            json.dumps(data_stats)
        )
        
        self.cursor.execute(query, values)
        self.conn.commit()
    
    def get_latest_record_date(self, data: Dict) -> str:
        """Find the most recent date from all records"""
        dates = []
        
        for key, records in data.items():
            if isinstance(records, list) and records:
                for record in records:
                    if 'record_date' in record:
                        dates.append(record['record_date'])
                    elif 'appointment_date' in record:
                        dates.append(record['appointment_date'])
                    elif 'prescribed_date' in record:
                        dates.append(record['prescribed_date'])
                    elif 'recorded_date' in record:
                        dates.append(record['recorded_date'])
        
        return max(dates) if dates else datetime.now().date()
    
    def get_summary(self, patient_id: int, force_refresh: bool = False) -> Dict:
        """Main API method - returns summary with metadata"""
        try:
            self.connect_db()
            self.ensure_summaries_table()
            
            # Check if summary exists
            last_summary_record = self.get_last_summary(patient_id)
            
            if not last_summary_record or force_refresh:
                # Generate full summary
                summary = self.generate_full_summary(patient_id)
                data = self.get_all_patient_data(patient_id)
                last_date = self.get_latest_record_date(data)
                
                data_stats = {
                    'records_count': len(data.get('medical_records', [])),
                    'appointments_count': len(data.get('appointments', [])),
                    'prescriptions_count': len(data.get('prescriptions', [])),
                    'vital_signs_count': len(data.get('vital_signs', [])),
                    'type': 'full'
                }
                
                is_new = True
                
            else:
                # Check for new data
                last_date = last_summary_record['last_record_date']
                new_data = self.get_new_data_since(patient_id, str(last_date))
                
                has_new_data = any(len(v) > 0 for v in new_data.values() if isinstance(v, list))
                
                if not has_new_data:
                    # Return existing summary
                    return {
                        'success': True,
                        'patient_id': patient_id,
                        'summary': last_summary_record['summary_text'],
                        'summary_date': str(last_summary_record['summary_date']),
                        'last_record_date': str(last_summary_record['last_record_date']),
                        'is_new': False,
                        'stats': json.loads(last_summary_record['data_included']),
                        'message': 'No new data since last summary'
                    }
                
                # Generate incremental summary
                summary = self.generate_incremental_summary(
                    patient_id,
                    last_summary_record['summary_text'],
                    new_data
                )
                
                last_date = self.get_latest_record_date(new_data)
                
                data_stats = {
                    'new_records_count': len(new_data.get('medical_records', [])),
                    'new_appointments_count': len(new_data.get('appointments', [])),
                    'new_prescriptions_count': len(new_data.get('prescriptions', [])),
                    'new_vital_signs_count': len(new_data.get('vital_signs', [])),
                    'type': 'incremental'
                }
                
                is_new = True
            
            # Save summary
            if is_new:
                self.save_summary(patient_id, summary, str(last_date), data_stats)
            
            return {
                'success': True,
                'patient_id': patient_id,
                'summary': summary,
                'summary_date': str(datetime.now().date()),
                'last_record_date': str(last_date),
                'is_new': is_new,
                'stats': data_stats,
                'message': 'Summary generated successfully'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Failed to generate summary'
            }
        finally:
            self.close_db()