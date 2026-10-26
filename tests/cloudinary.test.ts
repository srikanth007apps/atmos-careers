import { describe, expect, it } from "vitest";
import { createResumeDownloadUrl, createResumeUploadSignature, isOurResumePublicId } from "@/lib/server/cloudinary";

describe("Cloudinary integration helpers (no network)", () => {
  it("signs a private (authenticated) raw upload into the job's folder", () => {
    const s = createResumeUploadSignature("job1", "pdf");
    expect(s.uploadUrl).toBe("https://api.cloudinary.com/v1_1/demo-cloud/raw/upload");
    expect(s.fields.type).toBe("authenticated");
    expect(s.fields.signature).toMatch(/^[a-f0-9]{40}$/);
    expect(s.publicId).toMatch(/^atmos-careers\/resumes\/job1\/[0-9a-f-]{36}\.pdf$/);
    expect(s.fields).not.toHaveProperty("api_secret");
  });

  it("only accepts public IDs from our folder for the same job", () => {
    expect(isOurResumePublicId("atmos-careers/resumes/job1/a.pdf", "job1")).toBe(true);
    expect(isOurResumePublicId("atmos-careers/resumes/job2/a.pdf", "job1")).toBe(false);
    expect(isOurResumePublicId("atmos-careers/resumes/job1/../job2/a.pdf", "job1")).toBe(false);
  });

  it("builds an expiring signed download link", () => {
    const url = new URL(createResumeDownloadUrl("atmos-careers/resumes/job1/a.pdf", 60));
    expect(url.hostname).toBe("api.cloudinary.com");
    const expires = Number(url.searchParams.get("expires_at"));
    expect(expires - Date.now() / 1000).toBeLessThanOrEqual(61);
    expect(url.searchParams.get("signature")).toBeTruthy();
    expect(url.searchParams.get("type")).toBe("authenticated");
  });
});
