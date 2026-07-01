import { z } from "zod";

export const updatePatientProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(150),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional().nullable(),
    bloodGroup: z.string().max(10).optional().nullable(),
    phone: z.string().max(30).optional().nullable(),
    address: z.string().optional().nullable(),
    emergencyContact: z.string().max(255).optional().nullable(),
  }),
});

export const addVitalSignsSchema = z.object({
  body: z.object({
    bloodPressure: z.string().max(20).optional().nullable(),
    heartRate: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional().nullable(),
    temperature: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
    weight: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
    recordedDate: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
});
