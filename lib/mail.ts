import nodemailer from "nodemailer";
import { APP_NAME } from "@/lib/brand";
import { contactEmail, publicBaseUrl } from "@/lib/public-url";

export function isMailConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

function fromAddress() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    `noreply@veotv.cloud`
  );
}

function transporter() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) {
    throw new Error(
      "Correo no configurado. Define SMTP_HOST, SMTP_USER y SMTP_PASS."
    );
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

function wrapHtml(title: string, body: string) {
  const brand = APP_NAME;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0b0b0b;color:#f5f5f5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0b;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#161616;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #2a2a2a;">
          <p style="margin:0;font-size:22px;font-weight:800;color:#5EEAD4;letter-spacing:-0.02em;">${brand}</p>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#fff;">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid #2a2a2a;">
          <p style="margin:0;font-size:12px;color:#888;line-height:1.5;">
            Si no solicitaste este correo, puedes ignorarlo.<br/>
            Soporte: ${contactEmail()}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!isMailConfigured()) {
    console.warn("[mail] SMTP no configurado. Correo no enviado:", opts.subject, "→", opts.to);
    console.warn("[mail] Texto:", opts.text);
    return { ok: false as const, skipped: true as const };
  }

  const transport = transporter();
  await transport.sendMail({
    from: `"${APP_NAME}" <${fromAddress()}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  return { ok: true as const, skipped: false as const };
}

export async function sendEmailVerification(opts: {
  to: string;
  name: string;
  token: string;
}) {
  const url = `${publicBaseUrl()}/verificar-email?token=${encodeURIComponent(opts.token)}`;
  const subject = `Confirma tu cuenta en ${APP_NAME}`;
  const text = `Hola ${opts.name},\n\nConfirma tu correo abriendo este enlace (válido 24 h):\n${url}\n\n— ${APP_NAME}`;
  const html = wrapHtml(
    "Confirma tu correo",
    `<p style="margin:0 0 16px;color:#cfcfcf;line-height:1.55;">Hola <strong style="color:#fff;">${escapeHtml(opts.name)}</strong>, gracias por registrarte en ${APP_NAME}. Confirma tu email para activar la cuenta.</p>
     <p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background:#5EEAD4;color:#07111D;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">Confirmar correo</a></p>
     <p style="margin:0;font-size:13px;color:#888;word-break:break-all;">O copia este enlace:<br/>${url}</p>`
  );
  return sendMail({ to: opts.to, subject, html, text });
}

export async function sendPasswordReset(opts: {
  to: string;
  name: string;
  token: string;
}) {
  const url = `${publicBaseUrl()}/restablecer-clave?token=${encodeURIComponent(opts.token)}`;
  const subject = `Restablecer contraseña · ${APP_NAME}`;
  const text = `Hola ${opts.name},\n\nRestablece tu contraseña (válido 1 h):\n${url}\n\nSi no lo pediste, ignora este mensaje.\n\n— ${APP_NAME}`;
  const html = wrapHtml(
    "Restablecer contraseña",
    `<p style="margin:0 0 16px;color:#cfcfcf;line-height:1.55;">Hola <strong style="color:#fff;">${escapeHtml(opts.name)}</strong>, recibimos una solicitud para cambiar tu contraseña.</p>
     <p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background:#5EEAD4;color:#07111D;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">Elegir nueva contraseña</a></p>
     <p style="margin:0;font-size:13px;color:#888;word-break:break-all;">O copia este enlace:<br/>${url}</p>`
  );
  return sendMail({ to: opts.to, subject, html, text });
}

export async function sendPasswordChangedNotice(opts: {
  to: string;
  name: string;
}) {
  const subject = `Tu contraseña fue actualizada · ${APP_NAME}`;
  const text = `Hola ${opts.name},\n\nTu contraseña en ${APP_NAME} se actualizó correctamente. Si no fuiste tú, contacta a ${contactEmail()}.\n`;
  const html = wrapHtml(
    "Contraseña actualizada",
    `<p style="margin:0;color:#cfcfcf;line-height:1.55;">Hola <strong style="color:#fff;">${escapeHtml(opts.name)}</strong>, tu contraseña se cambió correctamente. Si no reconoces este cambio, escribe a <a href="mailto:${contactEmail()}" style="color:#5EEAD4;">${contactEmail()}</a>.</p>`
  );
  return sendMail({ to: opts.to, subject, html, text });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
