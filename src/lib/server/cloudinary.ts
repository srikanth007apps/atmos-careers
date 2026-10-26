import "server-only";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { RESUME_KINDS, type ResumeKind } from "@/lib/file-validation";
import { serverEnv } from "./env";

/**
 * Resumes are uploaded as Cloudinary `raw` assets with delivery type `authenticated`,
 * so they can only be fetched with a signed, short-lived download link generated here.
 */
const RESOURCE_TYPE = "raw" as const;
const DELIVERY_TYPE = "authenticated" as const;

let configured = false;
function client() {
  if (!configured) {
    cloudinary.config({
      cloud_name: serverEnv.cloudinary.cloudName,
      api_key: serverEnv.cloudinary.apiKey,
      api_secret: serverEnv.cloudinary.apiSecret,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

export interface SignedUpload {
  uploadUrl: string;
  fields: Record<string, string>;
  publicId: string;
}

/** Signs a one-off direct browser→Cloudinary upload with a server-chosen public_id. */
export function createResumeUploadSignature(jobId: string, kind: ResumeKind): SignedUpload {
  const c = client();
  const publicId = `${serverEnv.cloudinary.folder}/${jobId}/${randomUUID()}${RESUME_KINDS[kind].ext}`;
  const timestamp = Math.round(Date.now() / 1000);
  const params = { timestamp, public_id: publicId, type: DELIVERY_TYPE, overwrite: "false" };
  const signature = c.utils.api_sign_request(params, serverEnv.cloudinary.apiSecret);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${serverEnv.cloudinary.cloudName}/${RESOURCE_TYPE}/upload`,
    publicId,
    fields: {
      api_key: serverEnv.cloudinary.apiKey,
      timestamp: String(timestamp),
      public_id: publicId,
      type: DELIVERY_TYPE,
      overwrite: "false",
      signature,
    },
  };
}

/** The upload must live in our folder and belong to the job the candidate is applying for. */
export function isOurResumePublicId(publicId: string, jobId: string) {
  const prefix = `${serverEnv.cloudinary.folder}/${jobId}/`;
  return publicId.startsWith(prefix) && !publicId.includes("..") && /^[A-Za-z0-9_\-/.]+$/.test(publicId);
}

export interface StoredResume {
  publicId: string;
  bytes: number;
  /** Canonical (unsigned) delivery URL – returns 401 unless signed, so it is safe to store. */
  url: string;
  version: number;
}

export async function getResumeResource(publicId: string): Promise<StoredResume | null> {
  try {
    const res = await client().api.resource(publicId, { resource_type: RESOURCE_TYPE, type: DELIVERY_TYPE });
    const url = client().url(publicId, {
      resource_type: RESOURCE_TYPE,
      type: DELIVERY_TYPE,
      version: res.version,
      secure: true,
      sign_url: false,
    });
    return { publicId, bytes: Number(res.bytes), url, version: Number(res.version) };
  } catch (err) {
    const status = (err as { error?: { http_code?: number } })?.error?.http_code;
    if (status === 404) return null;
    throw err;
  }
}

/** A signed Cloudinary download link that expires after `ttlSeconds`. */
export function createResumeDownloadUrl(publicId: string, ttlSeconds = 60, attachment = true) {
  return client().utils.private_download_url(publicId, "", {
    resource_type: RESOURCE_TYPE,
    type: DELIVERY_TYPE,
    expires_at: Math.round(Date.now() / 1000) + ttlSeconds,
    attachment,
  });
}

/** Downloads the uploaded file server-side so its real content can be inspected. */
export async function fetchResumeBytes(publicId: string): Promise<Uint8Array> {
  const res = await fetch(createResumeDownloadUrl(publicId, 120, false), { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not read uploaded resume (HTTP ${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function deleteResume(publicId: string) {
  try {
    await client().uploader.destroy(publicId, { resource_type: RESOURCE_TYPE, type: DELIVERY_TYPE, invalidate: true });
  } catch (err) {
    console.error("[cloudinary] failed to delete", publicId, err);
  }
}
