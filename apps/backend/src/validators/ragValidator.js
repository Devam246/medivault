import { z } from "zod";

export const patientRagChatSchema = z.object({
  body: z.object({
    message: z.string().min(1, "Message is required"),
    top_k: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  }),
});
