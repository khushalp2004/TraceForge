import { sendEmail } from "./mailer.js";
import { buildSecurityAlertEmail } from "./emailTemplates.js";

export const sendSecurityAlertEmail = async ({
  email,
  fullName,
  ip
}: {
  email: string;
  fullName?: string | null;
  ip?: string | null;
}) => {
  const { text, html } = buildSecurityAlertEmail({
    fullName,
    ip
  });

  await sendEmail({
    to: email,
    subject: "Security Alert: Multiple failed login attempts",
    text,
    html
  });
};
