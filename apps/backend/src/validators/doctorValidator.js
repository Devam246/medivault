import { z } from "zod";

export const createPrescriptionSchema = z.object({
  body: z.object({
    patientId: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]),
    medicineName: z.string().min(1, "Medicine name is required").max(255),
    dosage: z.string().min(1, "Dosage is required").max(255),
    duration: z.string().max(255).optional().nullable(),
    instructions: z.string().optional().nullable(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format").optional().nullable(),
  }),
});

const dayAvailabilitySchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be in HH:MM format"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "End time must be in HH:MM format"),
});

export const updateDoctorAvailabilitySchema = z.object({
  body: z.object({
    monday: dayAvailabilitySchema,
    tuesday: dayAvailabilitySchema,
    wednesday: dayAvailabilitySchema,
    thursday: dayAvailabilitySchema,
    friday: dayAvailabilitySchema,
    saturday: dayAvailabilitySchema,
    sunday: dayAvailabilitySchema,
  }),
});
