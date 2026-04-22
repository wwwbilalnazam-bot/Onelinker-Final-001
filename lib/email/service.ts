import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "hello@onelinker.ai";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  from = FROM_EMAIL,
}: EmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not configured, skipping email");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const result = await resend.emails.send({
      from: `Onelinker <${from}>`,
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error("[Email] Failed to send email:", result.error);
      return { success: false, error: result.error };
    }

    console.log(`[Email] Sent to ${to}: ${subject}`);
    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error("[Email] Error sending email:", error);
    return { success: false, error };
  }
}

export function wrapEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .email-body { background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .email-footer { text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; margin-top: 40px; font-size: 12px; color: #6b7280; }
          a { color: #7c3aed; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .btn { display: inline-block; background-color: #7c3aed; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
          .btn:hover { background-color: #6d28d9; }
          h1, h2 { color: #1f2937; margin-top: 0; }
          p { color: #4b5563; line-height: 1.6; margin-bottom: 16px; }
          .highlight { background-color: #f3f4f6; padding: 16px; border-left: 4px solid #7c3aed; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="email-body">
            ${content}
            <div class="email-footer">
              <p>© 2026 Onelinker. All rights reserved.</p>
              <p><a href="https://onelinker.ai">Visit our website</a></p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}
