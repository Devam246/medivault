import { z } from "zod";

export const registerPatientSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(150, "Name must be under 150 characters"),
    email: z.string().email("Invalid email address").max(255),
    password: z.string().min(6, "Password must be at least 6 characters").max(255),
  }),
});

export const registerDoctorSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(150),
    email: z.string().email("Invalid email address").max(255),
    password: z.string().min(6, "Password must be at least 6 characters").max(255),
    regNumber: z.string().min(1, "Registration number is required").max(100),
    degree: z.string().min(1, "Degree is required").max(255),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address").max(255),
    password: z.string().min(1, "Password is required"),
    role: z.enum(["patient", "doctor", "admin"], {
      errorMap: () => ({ message: "Role must be 'patient', 'doctor', or 'admin'" }),
    }),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});
