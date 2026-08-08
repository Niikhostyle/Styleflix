import { Resend } from "resend";
import { APP_NAME } from "@/lib/brand";

let client: Resend | null = null;

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY no configurada.");
  }
  if (!client) client = new Resend(key);
  return client;
}

/** Remitente verificado en Resend (dominio veotv.cloud). */
export function resendFromAddress() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    `VeoTV <noreply@veotv.cloud>`
  );
}

export async function sendWithResend(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: resendFromAddress(),
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (error) {
    console.error("[mail] Resend error:", error);
    return { ok: false as const, skipped: false as const, error };
  }

  return { ok: true as const, skipped: false as const, data };
}
