import { z } from "zod";
import { APPLICATION_STATUSES, EMPLOYMENT_TYPES } from "@/lib/constants";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export function htmlToText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const jobInputSchema = z.object({
  title: z.string().trim().min(3, "Job title is required").max(150),
  description: z
    .string()
    .max(50_000, "Description is too long")
    .refine((html) => htmlToText(html).length >= 30, "Job description is required (at least 30 characters)"),
  departmentId: z.string().min(1, "Department is required").max(64),
  employmentType: z
    .enum(EMPLOYMENT_TYPES)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null))
    .transform((v) => v ?? null),
  location: optionalText(120),
  vacancies: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 999), "Vacancies must be a whole number between 1 and 999"),
  applicationDeadline: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Invalid date"),
});

export type JobInput = z.input<typeof jobInputSchema>;
export type JobInputParsed = z.output<typeof jobInputSchema>;

export const jobSaveSchema = jobInputSchema.extend({
  intent: z.enum(["draft", "publish"]).default("draft"),
});

export const jobStatusActionSchema = z.object({
  action: z.enum(["publish", "close", "reopen", "unpublish"]),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Department name is required").max(80),
});

export const departmentUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  isActive: z.boolean().optional(),
});

export const applicationUpdateSchema = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    note: z.string().trim().max(2000).optional().default(""),
    recruiterNotes: z.string().max(10_000).optional(),
    notifyCandidate: z.boolean().optional().default(false),
  })
  .refine((v) => v.status !== undefined || v.recruiterNotes !== undefined, "Nothing to update");

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(200),
});

export const passwordPolicy = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordPolicy,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const settingsSchema = z.object({
  notifications: z.object({
    sendAcknowledgement: z.boolean(),
    sendStatusUpdates: z.boolean(),
  }),
});
