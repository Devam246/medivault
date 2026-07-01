import * as prescriptionRepository from "../repositories/prescriptionRepository.js";
import * as accessLogRepository from "../repositories/accessLogRepository.js";

export async function createPrescription(req, res, next) {
  try {
    const doctorId = req.user.id;
    const { patientId, medicineName, dosage, duration, instructions, endDate } = req.body;

    const prescription = await prescriptionRepository.createPrescription({
      patient_id: Number(patientId),
      doctor_id: Number(doctorId),
      medicine_name: medicineName,
      dosage,
      duration: duration || null,
      instructions: instructions || null,
      prescribed_date: new Date().toISOString().slice(0, 10),
      end_date: endDate || null,
    });

    // Audit Log for creating prescription
    await accessLogRepository.logAccess({
      actor_user_id: doctorId,
      patient_id: Number(patientId),
      action: "create_prescription",
      entity_type: "prescription",
      entity_id: String(prescription.id),
      metadata: { medicine_name: medicineName },
      ip_address: req.ip,
    });

    return res.status(201).json({ message: "Prescription created", prescription });
  } catch (err) {
    next(err);
  }
}

export async function getPrescriptionsForPatientByDoctor(req, res, next) {
  try {
    const doctorId = req.user.id;
    const { patientId } = req.params;

    const prescriptions = await prescriptionRepository.listPrescriptionsForDoctorPatient(doctorId, patientId);
    return res.json({ prescriptions });
  } catch (err) {
    next(err);
  }
}
