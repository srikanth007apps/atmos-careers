import { z } from "zod";

const INDIAN_MOBILE = /^(?:\+?91)?[6-9]\d{9}$/;
const INTERNATIONAL = /^\+[1-9]\d{7,14}$/;

export function normalisePhone(raw: string) {
  return raw.replace(/[\s\-().]/g, "");
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform(normalisePhone)
  .refine((v) => INDIAN_MOBILE.test(v) || INTERNATIONAL.test(v), {
    message: "Enter a valid 10-digit mobile number, or an international number starting with +",
  });

export const candidateFieldsSchema = z.object({
  candidateName: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(100, "Name is too long")
    .regex(/^[\p{L}\p{M}.' -]+$/u, "Name can only contain letters, spaces, dots, apostrophes and hyphens"),
  phone: phoneSchema,
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(200).toLowerCase(),
  message: z
    .string()
    .trim()
    .min(20, "Please write at least 20 characters about yourself")
    .max(3000, "Message must be under 3000 characters"),
  consent: z.literal(true, { errorMap: () => ({ message: "Please accept the privacy notice to continue" }) }),
});

export type CandidateFields = z.infer<typeof candidateFieldsSchema>;

/** What the browser sends to POST /api/applications after the resume is uploaded. */
export const applicationSubmissionSchema = candidateFieldsSchema.extend({
  jobId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Invalid job"),
  idempotencyKey: z.string().uuid(),
  resume: z.object({
    publicId: z.string().min(1).max(300),
    originalFileName: z.string().min(1).max(255),
  }),
});

export type ApplicationSubmission = z.infer<typeof applicationSubmissionSchema>;

/** Request body for obtaining a signed Cloudinary upload. */
export const uploadSignatureSchema = z.object({
  jobId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  fileType: z.string().max(200).optional().default(""),
});
