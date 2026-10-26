/**
 * Resume file rules shared by the browser and the server.
 * We check the declared type/extension AND the file's leading bytes ("magic numbers").
 */
export type ResumeKind = "pdf" | "docx" | "doc";

export const RESUME_KINDS: Record<ResumeKind, { ext: string; mime: string[]; label: string }> = {
  pdf: { ext: ".pdf", mime: ["application/pdf"], label: "PDF" },
  docx: {
    ext: ".docx",
    mime: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    label: "DOCX",
  },
  doc: { ext: ".doc", mime: ["application/msword"], label: "DOC" },
};

export function allowedKinds(allowWord: boolean): ResumeKind[] {
  return allowWord ? ["pdf", "docx", "doc"] : ["pdf"];
}

export function acceptAttribute(allowWord: boolean) {
  return allowedKinds(allowWord)
    .flatMap((k) => [RESUME_KINDS[k].ext, ...RESUME_KINDS[k].mime])
    .join(",");
}

export function kindFromFileName(name: string): ResumeKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".doc")) return "doc";
  return null;
}

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);

/** Detect the real file type from its contents. Pass at least the first 8 bytes (whole file for DOCX certainty). */
export function detectKindFromBytes(bytes: Uint8Array): ResumeKind | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "doc"; // OLE2 compound file
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    // ZIP container – make sure it is a Word document when we have enough bytes to tell
    if (bytes.length <= 8) return "docx";
    const text = new TextDecoder("latin1").decode(bytes);
    return text.includes("word/") ? "docx" : null;
  }
  return null;
}

export interface FileCheckInput {
  name: string;
  size: number;
  type?: string;
}

export function validateResumeMeta(
  file: FileCheckInput,
  opts: { maxBytes: number; allowWord: boolean },
): { ok: true; kind: ResumeKind } | { ok: false; error: string } {
  const kind = kindFromFileName(file.name);
  const allowed = allowedKinds(opts.allowWord);
  const allowedLabel = allowed.map((k) => RESUME_KINDS[k].label).join(", ");
  if (!kind || !allowed.includes(kind)) {
    return { ok: false, error: `Unsupported file type. Please upload ${allowedLabel}.` };
  }
  if (file.type && file.type !== "application/octet-stream" && !RESUME_KINDS[kind].mime.includes(file.type)) {
    return { ok: false, error: `The file does not look like a valid ${RESUME_KINDS[kind].label}.` };
  }
  if (file.size <= 0) return { ok: false, error: "The selected file is empty." };
  if (file.size > opts.maxBytes) {
    return { ok: false, error: `File is too large. Maximum size is ${Math.round(opts.maxBytes / 1024 / 1024)} MB.` };
  }
  return { ok: true, kind };
}

/** Same-family check: a .docx extension must contain a DOCX, etc. */
export function contentMatchesKind(declared: ResumeKind, detected: ResumeKind | null) {
  return detected === declared;
}
