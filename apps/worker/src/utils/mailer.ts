const resendApiKey = process.env.RESEND_API_KEY;
const resendApiUrl = process.env.RESEND_API_URL || "https://api.resend.com/emails";
const resendFrom = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || "TraceForge <no-reply@traceforge.local>";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export const sendWithResend = async ({
  to,
  subject,
  text,
  html,
  replyTo
}: SendEmailInput) => {
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY not found. Skipping email send:", { to, subject });
    return;
  }

  const response = await fetch(resendApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [to],
      reply_to: replyTo ? [replyTo] : undefined,
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend error: ${response.status} ${errorBody}`);
  }
};
