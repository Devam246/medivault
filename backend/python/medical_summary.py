# backend/python/medical_summary.py

import mysql.connector
import google.generativeai as genai
from datetime import datetime
import json
import os
from typing import Dict, List, Optional

class MedicalSummarizer:
    def __init__(self, db_config, gemini_api_key):
        self.db_config = db_config
        genai.configure(api_key=gemini_api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        self.conn = None
        self.cursor = None
    
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
        """Format medical data into readable text for Gemini"""
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
        
        response = self.model.generate_content(prompt)
        return response.text
    
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
        
        response = self.model.generate_content(prompt)
        return response.text
    
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