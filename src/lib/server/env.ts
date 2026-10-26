import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.includes("replace-me") || value.includes("REPLACE_ME")) {
    throw new Error(`Missing environment variable ${name}. See .env.example and README.md.`);
  }
  return value;
}

export const serverEnv = {
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  cloudinary: {
    get cloudName() {
      return required("CLOUDINARY_CLOUD_NAME");
    },
    get apiKey() {
      return required("CLOUDINARY_API_KEY");
    },
    get apiSecret() {
      return required("CLOUDINARY_API_SECRET");
    },
    get folder() {
      return (process.env.CLOUDINARY_RESUME_FOLDER || "atmos-careers/resumes").replace(/^\/+|\/+$/g, "");
    },
  },
  resume: {
    get maxBytes() {
      const mb = Number(process.env.RESUME_MAX_SIZE_MB || 5);
      return Math.round((Number.isFinite(mb) && mb > 0 ? mb : 5) * 1024 * 1024);
    },
    get allowWord() {
      return (process.env.RESUME_ALLOW_WORD ?? "true") !== "false";
    },
  },
  email: {
    get enabled() {
      return process.env.EMAIL_ENABLED === "true";
    },
    get host() {
      return required("SMTP_HOST");
    },
    get port() {
      return Number(process.env.SMTP_PORT || 587);
    },
    get secure() {
      return process.env.SMTP_SECURE === "true";
    },
    get user() {
      return required("SMTP_USER");
    },
    get pass() {
      return required("SMTP_PASS");
    },
    get from() {
      return required("EMAIL_FROM");
    },
  },
};
