import { Resend } from "resend";
import { stripEnv } from "@/lib/env";

let client: Resend | null = null;
let clientKey: string | null = null;

export function getResendApiKey() {
  return stripEnv(process.env.RESEND_API_KEY);
}

export function isResendConfigured() {
  const key = getResendApiKey();
  return key.length > 8 && key.startsWith("re_");
}

function getResend() {
  const key = getResendApiKey();
  if (!key) {
    throw new Error("RESEND_API_KEY no configurada.");
  }
  // Recrear cliente si cambió la key (hot reload / redeploy)
  if (!client || clientKey !== key) {
    client = new Resend(key);
    clientKey = key;
  }
  return client;
}

/**
 * Remitente verificado en Resend.
 * Coolify: preferí EMAIL_FROM=noreply@veotv.cloud (sin < >).
 */
export function resendFromAddress() {
  const raw = stripEnv(process.env.EMAIL_FROM);
  if (raw.includes("@") && raw.includes("<") && raw.includes(">")) {
    return raw;
  }
  if (raw.includes("@")) {
    return `VeoTV <${raw}>`;
  }
  return "VeoTV <noreply@veotv.cloud>";
}

export function mailConfigSnapshot() {
  const key = getResendApiKey();
  return {
    resendConfigured: isResendConfigured(),
    resendKeyPrefix: key ? `${key.slice(0, 5)}…` : null,
    resendKeyLen: key.length,
    from: resendFromAddress(),
    smtpConfigured: Boolean(
      stripEnv(process.env.SMTP_HOST) &&
        stripEnv(process.env.SMTP_USER) &&
        stripEnv(process.env.SMTP_PASS)
    ),
  };
}

export async function sendWithResend(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const from = resendFromAddress();
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (error) {
    console.error("[mail] Resend error:", {
      from,
      to: opts.to,
      subject: opts.subject,
      error,
    });
    return { ok: false as const, skipped: false as const, error };
  }

  console.info("[mail] Resend OK:", {
    from,
    to: opts.to,
    subject: opts.subject,
    id: data?.id,
  });
  return { ok: true as const, skipped: false as const, data };
}
