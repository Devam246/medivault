CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_role_verified ON users(role, is_verified);
CREATE INDEX idx_users_phone ON users(phone);

CREATE INDEX idx_doctor_profiles_specialty ON doctor_profiles(specialty);
CREATE INDEX idx_doctor_profiles_location ON doctor_profiles(location);

CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_patient_date ON appointments(patient_id, appointment_date);
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);

CREATE INDEX idx_medical_records_patient_id ON medical_records(patient_id);
CREATE INDEX idx_medical_records_doctor_id ON medical_records(doctor_id);
CREATE INDEX idx_medical_records_patient_date ON medical_records(patient_id, record_date);

CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_patient_end_date ON prescriptions(patient_id, end_date);

CREATE INDEX idx_vital_signs_patient_id ON vital_signs(patient_id);
CREATE INDEX idx_vital_signs_patient_recorded ON vital_signs(patient_id, recorded_date);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_created_at ON refresh_tokens(created_at);

CREATE UNIQUE INDEX uq_patient_access_tokens_token ON patient_access_tokens(token);
CREATE INDEX idx_patient_access_tokens_patient_id ON patient_access_tokens(patient_id);
CREATE INDEX idx_patient_access_tokens_doctor_id ON patient_access_tokens(doctor_id);
CREATE INDEX idx_patient_access_tokens_appointment_id ON patient_access_tokens(appointment_id);
CREATE INDEX idx_patient_access_tokens_active_lookup ON patient_access_tokens(patient_id, doctor_id, is_active, expires_at);

CREATE INDEX idx_access_logs_actor_user_id ON access_logs(actor_user_id);
CREATE INDEX idx_access_logs_patient_id ON access_logs(patient_id);
CREATE INDEX idx_access_logs_action_created ON access_logs(action, created_at);
