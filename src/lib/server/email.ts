import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { siteConfig } from "@/config/site";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/constants";
import { serverEnv } from "./env";
import { escapeHtml } from "./sanitize";

export type EmailResult = "sent" | "failed" | "skipped";

let transporter: Transporter | undefined;
function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: serverEnv.email.host,
    port: serverEnv.email.port,
    secure: serverEnv.email.secure,
    auth: { user: serverEnv.email.user, pass: serverEnv.email.pass },
  });
  return transporter;
}

export function isEmailConfigured() {
  return serverEnv.email.enabled;
}

/** Returns "sent" ONLY when the SMTP server accepted the recipient. */
async function send(to: string, subject: string, text: string, html: string): Promise<EmailResult> {
  if (!serverEnv.email.enabled) return "skipped";
  try {
    const info = await getTransporter().sendMail({ from: serverEnv.email.from, to, subject, text, html });
    const accepted = ((info.accepted ?? []) as unknown[]).map((a) =>
      (typeof a === "string" ? a : String((a as { address?: string }).address ?? "")).toLowerCase(),
    );
    return accepted.includes(to.toLowerCase()) ? "sent" : "failed";
  } catch (err) {
    console.error("[email] send failed", err);
    return "failed";
  }
}

function wrap(bodyHtml: string) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2a24;max-width:560px">
${bodyHtml}
<p style="margin-top:28px;color:#6b7a70;font-size:13px">${escapeHtml(siteConfig.companyName)} · Human Resources<br/>This is an automated message – please do not reply.</p></div>`;
}

export function sendApplicationAcknowledgement(to: string, name: string, jobTitle: string) {
  const subject = `We received your application – ${jobTitle}`;
  const text = `Dear ${name},\n\nThank you for applying for the ${jobTitle} role at ${siteConfig.companyName}. Our HR team will review your application and contact you if your profile matches our requirements.\n\nRegards,\n${siteConfig.companyName} HR`;
  const html = wrap(
    `<p>Dear ${escapeHtml(name)},</p><p>Thank you for applying for the <strong>${escapeHtml(jobTitle)}</strong> role at ${escapeHtml(siteConfig.companyName)}. Our HR team will review your application and contact you if your profile matches our requirements.</p>`,
  );
  return send(to, subject, text, html);
}

const STATUS_MESSAGES: Partial<Record<ApplicationStatus, string>> = {
  under_review: "Your application is now being reviewed by our hiring team.",
  shortlisted: "Good news – your profile has been shortlisted. Our team will reach out with next steps.",
  interview_scheduled: "We'd like to meet you. Our team will share the interview details with you shortly.",
  selected: "Congratulations! You have been selected. Our HR team will contact you with the offer details.",
  rejected:
    "Thank you for your interest. After careful consideration, we will not be moving forward with your application at this time. We encourage you to apply for future openings.",
  withdrawn: "Your application has been marked as withdrawn.",
};

export function canNotifyStatus(status: ApplicationStatus) {
  return status in STATUS_MESSAGES;
}

export function sendStatusUpdate(to: string, name: string, jobTitle: string, status: ApplicationStatus) {
  const line = STATUS_MESSAGES[status];
  if (!line) return Promise.resolve<EmailResult>("skipped");
  const subject = `Update on your application – ${jobTitle}`;
  const text = `Dear ${name},\n\n${line}\n\nRole: ${jobTitle}\nStatus: ${APPLICATION_STATUS_LABELS[status]}\n\nRegards,\n${siteConfig.companyName} HR`;
  const html = wrap(
    `<p>Dear ${escapeHtml(name)},</p><p>${escapeHtml(line)}</p><p><strong>Role:</strong> ${escapeHtml(jobTitle)}<br/><strong>Status:</strong> ${APPLICATION_STATUS_LABELS[status]}</p>`,
  );
  return send(to, subject, text, html);
}
