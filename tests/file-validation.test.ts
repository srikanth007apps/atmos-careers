import { describe, expect, it } from "vitest";
import { contentMatchesKind, detectKindFromBytes, validateResumeMeta } from "@/lib/file-validation";

const MB = 1024 * 1024;
const opts = { maxBytes: 5 * MB, allowWord: true };

describe("resume file validation", () => {
  it("detects real content from magic bytes", () => {
    expect(detectKindFromBytes(new TextEncoder().encode("%PDF-1.4 ..."))).toBe("pdf");
    expect(detectKindFromBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe("doc");
    const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode("....[Content_Types].xml word/document.xml")]);
    expect(detectKindFromBytes(docx)).toBe("docx");
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode("....payload/evil.exe")]);
    expect(detectKindFromBytes(zip)).toBeNull();
    expect(detectKindFromBytes(new TextEncoder().encode("MZ\x90\x00 executable"))).toBeNull();
  });

  it("rejects a renamed file whose content doesn't match its extension", () => {
    const fakePdf = new TextEncoder().encode("<html>not a pdf</html>");
    expect(contentMatchesKind("pdf", detectKindFromBytes(fakePdf))).toBe(false);
  });

  it("enforces allowed types and size limit", () => {
    expect(validateResumeMeta({ name: "cv.pdf", size: MB, type: "application/pdf" }, opts).ok).toBe(true);
    expect(validateResumeMeta({ name: "cv.exe", size: MB }, opts).ok).toBe(false);
    expect(validateResumeMeta({ name: "cv.png", size: MB, type: "image/png" }, opts).ok).toBe(false);
    expect(validateResumeMeta({ name: "cv.pdf", size: 6 * MB }, opts)).toMatchObject({ ok: false });
    expect(validateResumeMeta({ name: "cv.pdf", size: 0 }, opts).ok).toBe(false);
    expect(validateResumeMeta({ name: "cv.pdf", size: MB, type: "image/jpeg" }, opts).ok).toBe(false);
    expect(validateResumeMeta({ name: "cv.docx", size: MB }, { ...opts, allowWord: false }).ok).toBe(false);
  });
});
