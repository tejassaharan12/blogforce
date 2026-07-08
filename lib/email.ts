import { Resend } from "resend";

const TO_EMAIL = "mediat.storydigital@gmail.com";
const FROM_EMAIL = "BlogForce <onboarding@resend.dev>";

export type AlertType = "generation_error" | "service_down" | "budget_warning";

interface AlertPayload {
  type: AlertType;
  title: string;
  details: string;
  brand?: string;
  topic?: string;
}

export async function sendAlert(payload: AlertPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // Fail silently — email is best-effort, never block generation

  const resend = new Resend(apiKey);

  const iconMap: Record<AlertType, string> = {
    generation_error: "🔴",
    service_down: "⚠️",
    budget_warning: "💸",
  };

  const icon = iconMap[payload.type];
  const subject = `${icon} BlogForce Alert: ${payload.title}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f0f11; color: #e4e4e7; border-radius: 12px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 32px;">${icon}</span>
        <h1 style="color: #fff; font-size: 20px; margin: 8px 0 4px;">${payload.title}</h1>
        <p style="color: #71717a; font-size: 13px; margin: 0;">BlogForce · Story Digital</p>
      </div>

      <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <pre style="color: #a1a1aa; font-size: 13px; white-space: pre-wrap; margin: 0;">${payload.details}</pre>
      </div>

      ${payload.brand ? `<p style="color: #71717a; font-size: 12px;">Brand: <strong style="color: #e4e4e7;">${payload.brand}</strong></p>` : ""}
      ${payload.topic ? `<p style="color: #71717a; font-size: 12px;">Topic: <strong style="color: #e4e4e7;">${payload.topic}</strong></p>` : ""}

      <p style="color: #52525b; font-size: 11px; margin-top: 24px; border-top: 1px solid #27272a; padding-top: 16px;">
        Sent by BlogForce at ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
        · <a href="https://blogforce.vercel.app/api/health" style="color: #a78bfa;">Check system health</a>
      </p>
    </div>
  `;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: TO_EMAIL,
    subject,
    html,
  }).catch(() => {}); // Never throw — email is non-critical
}
