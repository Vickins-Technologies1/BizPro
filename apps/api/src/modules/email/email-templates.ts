import { EmailTemplate } from "./email.schemas";

export type RenderedEmail = { subject: string; html: string; text: string };

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const unescapeHtml = (value: string) => value.replace(/&#39;|&quot;|&gt;|&lt;|&amp;/g, (entity) => ({ "&#39;": "'", "&quot;": '"', "&gt;": ">", "&lt;": "<", "&amp;": "&" })[entity]!);
const safeUrl = (value: unknown) => {
  const url = String(value ?? "");
  return /^https:\/\//i.test(url) || /^vickinsbos:\/\//i.test(url) ? escapeHtml(url) : "";
};

export function renderEmail(template: EmailTemplate, variables: Record<string, unknown>): RenderedEmail {
  const name = escapeHtml(variables.name || "there");
  const businessName = escapeHtml(variables.businessName || "Dira OS");
  const message = escapeHtml(variables.message || "");
  const actionUrl = safeUrl(variables.actionUrl);
  const actionLabel = escapeHtml(variables.actionLabel || "Open Dira OS");
  const details = escapeHtml(variables.details || "");
  const content: Record<EmailTemplate, { subject: string; heading: string; body: string }> = {
    welcome: { subject: "Welcome to Dira OS", heading: `Welcome, ${name}`, body: `Your ${businessName} workspace is ready.` },
    password_reset: { subject: "Your Dira OS password reset", heading: "Reset your password", body: `Use this one-time code to reset your password: ${message}. It expires shortly. If you did not request it, you can ignore this email.` },
    security_alert: { subject: "Dira OS account security alert", heading: "Account security notice", body: message || "A security related change was made to your account." },
    invitation: { subject: `Invitation to ${businessName}`, heading: "You are invited", body: message || `You have been invited to join ${businessName} on Dira OS.` },
    receipt: { subject: `Receipt from ${businessName}`, heading: "Your receipt", body: message || `Thank you for your purchase from ${businessName}.` },
    invoice: { subject: `Invoice from ${businessName}`, heading: "Invoice notification", body: message || `An invoice is available from ${businessName}.` },
    payment: { subject: `Payment update from ${businessName}`, heading: "Payment update", body: message || `There is an update about a payment to ${businessName}.` },
    subscription: { subject: "Dira OS subscription update", heading: "Subscription update", body: message || "There is an update about your Dira OS subscription." },
    report: { subject: `${businessName} business report`, heading: "Your business report", body: message || "Your requested business report is ready." },
    admin_notice: { subject: "Dira OS administration notice", heading: "Administration notice", body: message || "There is an administration update." }
  };
  const selected = content[template];
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(selected.subject)}</title></head><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#172033"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fa;padding:32px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:#102a43;padding:22px 32px;color:#fff;font-size:20px;font-weight:700">Dira OS</td></tr><tr><td style="padding:32px"><h1 style="font-size:24px;line-height:1.3;margin:0 0 18px">${escapeHtml(selected.heading)}</h1><p style="font-size:16px;line-height:1.6;margin:0 0 20px">${escapeHtml(selected.body)}</p>${details ? `<p style="font-size:14px;line-height:1.6;color:#52637a;white-space:pre-wrap">${details}</p>` : ""}${actionUrl ? `<p style="margin:26px 0"><a href="${actionUrl}" style="display:inline-block;background:#155eef;color:#fff;text-decoration:none;padding:12px 20px;border-radius:7px;font-weight:700">${actionLabel}</a></p>` : ""}<p style="font-size:13px;line-height:1.5;color:#52637a;margin:24px 0 0">This message relates to your Dira OS account or business activity.</p></td></tr><tr><td style="padding:18px 32px;background:#f8fafc;color:#52637a;font-size:12px">Dira OS · Clear tools for running your business</td></tr></table></td></tr></table></body></html>`;
  const text = `${unescapeHtml(selected.heading)}\n\n${unescapeHtml(selected.body)}${variables.details ? `\n\n${String(variables.details)}` : ""}${actionUrl ? `\n\n${actionLabel}: ${String(variables.actionUrl)}` : ""}\n\nDira OS`;
  return { subject: selected.subject, html, text };
}

export function normalizeEmailAddress(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 254 || /[\r\n\0]/.test(normalized) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalized)) {
    throw new Error("A valid recipient email address is required.");
  }
  return normalized;
}
