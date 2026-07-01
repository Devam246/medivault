import { z } from "zod";

export const requestAppointmentSchema = z.object({
  body: z.object({
    doctor_id: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]),
    appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    appointment_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be in HH:MM or HH:MM:SS format"),
    reason: z.string().max(1000).optional(),
  }),
});

export const bookAppointmentSchema = z.object({
  body: z.object({
    doctor_id: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]),
    appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    appointment_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be in HH:MM or HH:MM:SS format"),
    reason: z.string().max(1000).optional(),
  }),
});

export const respondToAppointmentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Appointment ID must be a number"),
  }),
  body: z.object({
    action: z.enum(["approve", "decline"], {
      errorMap: () => ({ message: "Action must be 'approve' or 'decline'" }),
    }),
  }),
});

export const grantEasyAccessSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "Appointment ID must be a number"),
  }),
});

export const grantEasyAccessParamsSchema = z.object({
  params: z.object({
    appointmentId: z.string().regex(/^\d+$/, "Appointment ID must be a number"),
  }),
});

export const createEmergencyAccessSchema = z.object({
  params: z.object({
    patientId: z.string().regex(/^\d+$/, "Patient ID must be a number"),
  }),
});
