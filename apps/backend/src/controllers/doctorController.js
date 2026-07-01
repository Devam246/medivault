import { AppError } from "../utils/AppError.js";
import * as userRepository from "../repositories/userRepository.js";
import * as appointmentRepository from "../repositories/appointmentRepository.js";
import * as medicalRecordRepository from "../repositories/medicalRecordRepository.js";
import * as prescriptionRepository from "../repositories/prescriptionRepository.js";
import * as vitalSignRepository from "../repositories/vitalSignRepository.js";
import * as patientAccessTokenRepository from "../repositories/patientAccessTokenRepository.js";
import * as accessLogRepository from "../repositories/accessLogRepository.js";

export async function getDoctorDashboard(req, res, next) {
  try {
    const doctorId = req.user.id;

    const appointments = await appointmentRepository.listAppointmentsByDoctor(doctorId);
    const today = new Date().toISOString().slice(0, 10);
    
    const todayAppointments = appointments
      .filter((appointment) => {
        // Date could be Date object or ISO string, standardize to YYYY-MM-DD
        const aptDateStr = appointment.appointment_date instanceof Date 
          ? appointment.appointment_date.toISOString().slice(0, 10)
          : String(appointment.appointment_date).slice(0, 10);
        return aptDateStr === today;
      })
      .sort((a, b) => String(a.appointment_time).localeCompare(String(b.appointment_time)));

    const totalPatients = new Set(appointments.map((appointment) => appointment.patient_id)).size;

    const recentPrescriptions = await prescriptionRepository.listPrescriptionsByDoctor(doctorId, 5);
    const recentRecords = await medicalRecordRepository.listMedicalRecordsByDoctor(doctorId, 5);

    return res.json({
      todayAppointments,
      totalPatients,
      recentPrescriptions,
      recentRecords,
    });
  } catch (err) {
    next(err);
  }
}

export async function searchPatient(req, res, next) {
  try {
    const { query } = req.query;
    if (!query || query.trim() === "") {
      return res.json({ patients: [] });
    }

    const patients = await userRepository.searchPatients(query);
    return res.json({ patients });
  } catch (err) {
    next(err);
  }
}

export async function getPatientHistory(req, res, next) {
  try {
    const patientId = req.params.id;
    const doctorId = req.user.id;

    const grant = await patientAccessTokenRepository.findActiveGrant(patientId, doctorId);
    if (!grant) {
      throw new AppError(
        "No active access grant. Ask the patient to tap Easy Access, or use Emergency Access.",
        403,
        "ACCESS_DENIED"
      );
    }

    const bundle = await vitalSignRepository.getPatientHistoryBundle(patientId);
    if (!bundle.profile) {
      throw new AppError("Patient not found", 404, "NOT_FOUND");
    }

    // Audit Log for doctor accessing history
    await accessLogRepository.logAccess({
      actor_user_id: doctorId,
      patient_id: patientId,
      action: "view_patient_history",
      entity_type: "patient",
      entity_id: patientId,
      metadata: { method: "normal" },
      ip_address: req.ip,
    });

    return res.json(bundle);
  } catch (err) {
    next(err);
  }
}
