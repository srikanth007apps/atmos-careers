import { describe, expect, it } from "vitest";
import { applicationSubmissionSchema, candidateFieldsSchema } from "@/lib/validation/application";
import { applicationUpdateSchema, changePasswordSchema, jobInputSchema } from "@/lib/validation/admin";

const valid = {
  candidateName: "Ananya Rao",
  phone: "98765 43210",
  email: "Ananya@Example.com",
  message: "I have five years of experience selling residential projects in Bengaluru.",
  consent: true,
};

describe("candidate application validation (test #4)", () => {
  it("accepts a valid application and normalises fields", () => {
    const out = candidateFieldsSchema.parse(valid);
    expect(out.phone).toBe("9876543210");
    expect(out.email).toBe("ananya@example.com");
  });

  it.each([
    ["missing name", { candidateName: "" }],
    ["bad email", { email: "not-an-email" }],
    ["short phone", { phone: "12345" }],
    ["landline-like number", { phone: "0123456789" }],
    ["empty message", { message: "" }],
    ["no consent", { consent: false }],
    ["script in name", { candidateName: "<script>alert(1)</script>" }],
  ])("rejects %s", (_label, patch) => {
    expect(candidateFieldsSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it("accepts Indian numbers with country code and international numbers", () => {
    expect(candidateFieldsSchema.safeParse({ ...valid, phone: "+91 98765-43210" }).success).toBe(true);
    expect(candidateFieldsSchema.safeParse({ ...valid, phone: "+971501234567" }).success).toBe(true);
  });

  it("requires a resume reference and idempotency key on submission", () => {
    expect(applicationSubmissionSchema.safeParse({ ...valid, jobId: "job1" }).success).toBe(false);
    expect(
      applicationSubmissionSchema.safeParse({
        ...valid,
        jobId: "job1",
        idempotencyKey: crypto.randomUUID(),
        resume: { publicId: "atmos-careers/resumes/job1/x.pdf", originalFileName: "cv.pdf" },
      }).success,
    ).toBe(true);
  });
});

describe("admin validation", () => {
  it("job requires title, description and department", () => {
    const r = jobInputSchema.safeParse({ title: "", description: "<p></p>", departmentId: "" });
    expect(r.success).toBe(false);
    const fields = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["title", "description", "departmentId"]));
  });
  it("optional job fields are normalised to null", () => {
    const r = jobInputSchema.parse({
      title: "Site Engineer",
      description: "<p>Supervise construction quality and safety on our Whitefield site.</p>",
      departmentId: "d1",
      employmentType: "",
      location: "",
      vacancies: "",
      applicationDeadline: "",
    });
    expect(r).toMatchObject({ employmentType: null, location: null, vacancies: null, applicationDeadline: null });
  });
  it("status updates only accept known statuses", () => {
    expect(applicationUpdateSchema.safeParse({ status: "shortlisted" }).success).toBe(true);
    expect(applicationUpdateSchema.safeParse({ status: "hired" }).success).toBe(false);
    expect(applicationUpdateSchema.safeParse({}).success).toBe(false);
  });
  it("password policy", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "short1", confirmPassword: "short1" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "LongEnough123", confirmPassword: "Different123" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "LongEnough123", confirmPassword: "LongEnough123" }).success).toBe(true);
  });
});
