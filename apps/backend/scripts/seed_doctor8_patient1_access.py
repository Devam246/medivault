import os
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv
import mysql.connector

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR.parent / '.env'
load_dotenv(ENV_PATH)

DB_HOST = os.getenv('DB_HOST')
DB_USER = os.getenv('DB_USER')
DB_PASS = os.getenv('DB_PASS')
DB_NAME = os.getenv('DB_NAME')

if not all([DB_HOST, DB_USER, DB_PASS, DB_NAME]):
    raise SystemExit('Missing DB env vars in backend/.env')

conn = mysql.connector.connect(
    host=DB_HOST,
    user=DB_USER,
    password=DB_PASS,
    database=DB_NAME,
)
cur = conn.cursor()

DOCTOR_ID = 8
PATIENT_ID = 1
DOCTOR_EMAIL = 'doctor.aisha+medivault-demo@medivault.test'

# Verify users
cur.execute(
    'SELECT id, name, email, role FROM users WHERE id IN (%s, %s) OR email=%s',
    (DOCTOR_ID, PATIENT_ID, DOCTOR_EMAIL),
)
users = cur.fetchall()
print('Existing user rows:', users)

# Validate doctor exists
cur.execute('SELECT id FROM users WHERE id=%s AND role=%s', (DOCTOR_ID, 'doctor'))
if cur.fetchone() is None:
    raise SystemExit(f'Doctor id={DOCTOR_ID} not found or not doctor role')

cur.execute('SELECT id FROM users WHERE id=%s AND role=%s', (PATIENT_ID, 'patient'))
if cur.fetchone() is None:
    raise SystemExit(f'Patient id={PATIENT_ID} not found or not patient role')

# Upsert doctor availability profile
cur.execute('SELECT id FROM doctor_profiles WHERE user_id=%s', (DOCTOR_ID,))
profile_exists = cur.fetchone() is not None
availability = {
    'specialty': 'Internal Medicine',
    'experience_years': 7,
    'consultation_fee': 600.0,
    'qualification': 'MBBS, MD',
    'location': 'Pune',
    'available_days': 'Mon,Tue,Wed,Thu,Fri',
    'available_time_start': '09:00:00',
    'available_time_end': '17:00:00',
    'slot_duration': 30,
    'bio': 'Focus on preventive care, diabetes, and lifestyle management.',
    'accepts_new_patients': 1,
    'online_consultation': 1,
}
if profile_exists:
    cur.execute(
        '''UPDATE doctor_profiles SET
             specialty=%s,
             experience_years=%s,
             consultation_fee=%s,
             qualification=%s,
             location=%s,
             available_days=%s,
             available_time_start=%s,
             available_time_end=%s,
             slot_duration=%s,
             bio=%s,
             accepts_new_patients=%s,
             online_consultation=%s
           WHERE user_id=%s''',
        (
            availability['specialty'],
            availability['experience_years'],
            availability['consultation_fee'],
            availability['qualification'],
            availability['location'],
            availability['available_days'],
            availability['available_time_start'],
            availability['available_time_end'],
            availability['slot_duration'],
            availability['bio'],
            availability['accepts_new_patients'],
            availability['online_consultation'],
            DOCTOR_ID,
        ),
    )
    print(f'Updated doctor_profiles for user_id={DOCTOR_ID}')
else:
    cur.execute(
        '''INSERT INTO doctor_profiles
             (user_id, specialty, experience_years, consultation_fee, qualification, location,
              available_days, available_time_start, available_time_end, slot_duration, bio,
              accepts_new_patients, online_consultation)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
        (
            DOCTOR_ID,
            availability['specialty'],
            availability['experience_years'],
            availability['consultation_fee'],
            availability['qualification'],
            availability['location'],
            availability['available_days'],
            availability['available_time_start'],
            availability['available_time_end'],
            availability['slot_duration'],
            availability['bio'],
            availability['accepts_new_patients'],
            availability['online_consultation'],
        ),
    )
    print(f'Inserted doctor_profiles for user_id={DOCTOR_ID}')

# Create or reuse a confirmed appointment
appointment_date = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
appointment_time = '10:00:00'
cur.execute(
    '''SELECT id FROM appointments
       WHERE patient_id=%s AND doctor_id=%s AND appointment_date=%s AND appointment_time=%s''',
    (PATIENT_ID, DOCTOR_ID, appointment_date, appointment_time),
)
row = cur.fetchone()
if row:
    appointment_id = row[0]
    print('Reusing existing appointment id', appointment_id)
else:
    cur.execute(
        '''INSERT INTO appointments
             (patient_id, doctor_id, appointment_date, appointment_time, reason, status, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, NOW())''',
        (PATIENT_ID, DOCTOR_ID, appointment_date, appointment_time, 'Demo booking for UI', 'confirmed'),
    )
    conn.commit()
    appointment_id = cur.lastrowid
    print('Inserted confirmed appointment id', appointment_id)

# Deactivate existing active grants for this patient-doctor pair
cur.execute(
    'UPDATE patient_access_tokens SET is_active = FALSE WHERE patient_id=%s AND doctor_id=%s AND is_active = TRUE',
    (PATIENT_ID, DOCTOR_ID),
)

# Insert a fresh active grant token
cur.execute(
    'SELECT id FROM patient_access_tokens WHERE patient_id=%s AND doctor_id=%s AND appointment_id=%s AND is_active = TRUE',
    (PATIENT_ID, DOCTOR_ID, appointment_id),
)
if cur.fetchone():
    print('Active access token already exists for appointment', appointment_id)
else:
    token = os.urandom(24).hex()
    cur.execute(
        '''INSERT INTO patient_access_tokens
             (patient_id, token, appointment_id, doctor_id, expires_at, is_active, created_at)
           VALUES (%s, %s, %s, %s, DATE_ADD(NOW(), INTERVAL 30 MINUTE), TRUE, NOW())''',
        (PATIENT_ID, token, appointment_id, DOCTOR_ID),
    )
    conn.commit()
    print('Inserted active access token for appointment', appointment_id)

# Seed minimal patient history data if missing
cur.execute('SELECT COUNT(*) FROM vital_signs WHERE patient_id=%s', (PATIENT_ID,))
if cur.fetchone()[0] == 0:
    cur.execute(
        'INSERT INTO vital_signs (patient_id, blood_pressure, heart_rate, temperature, weight, recorded_date, notes) VALUES (%s,%s,%s,%s,%s,CURDATE(),%s)',
        (PATIENT_ID, '120/80', '72', '98.6', '70', 'Seeded vital signs'),
    )
    conn.commit()
    print('Inserted seed vital signs for patient', PATIENT_ID)

cur.execute('SELECT COUNT(*) FROM medical_records WHERE patient_id=%s', (PATIENT_ID,))
if cur.fetchone()[0] == 0:
    cur.execute(
        'INSERT INTO medical_records (patient_id, title, type, record_date, notes, doctor_id) VALUES (%s,%s,%s,CURDATE(),%s,%s)',
        (PATIENT_ID, 'Seeded History Summary', 'General', 'Demo medical history record', DOCTOR_ID),
    )
    conn.commit()
    print('Inserted seed medical record for patient', PATIENT_ID)

cur.execute('SELECT COUNT(*) FROM prescriptions WHERE patient_id=%s', (PATIENT_ID,))
if cur.fetchone()[0] == 0:
    cur.execute(
        'INSERT INTO prescriptions (patient_id, doctor_id, medicine_name, dosage, duration, prescribed_date) VALUES (%s,%s,%s,%s,%s,CURDATE())',
        (PATIENT_ID, DOCTOR_ID, 'Seeded Medicine', '1 tablet daily', '5 days'),
    )
    conn.commit()
    print('Inserted seed prescription for patient', PATIENT_ID)

conn.close()
print('Seed complete.')
