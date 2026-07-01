import { z } from "zod";

export const uploadFileSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required").max(255),
    type: z.string().min(1, "Type is required").max(100),
    recordDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Record date must be in YYYY-MM-DD format").optional().nullable(),
    notes: z.string().optional().nullable(),
    patient_id: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional().nullable(),
  }),
});
