const productName = "TraceForge";
const supportEmail = process.env.SUPPORT_INBOX_EMAIL || "patilkhushal54321@gmail.com";
const webBaseUrl = process.env.WEB_BASE_URL || process.env.FRONTEND_URL || "http://localhost:3000";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderParagraphs = (paragraphs: string[]) =>
  paragraphs
    .map(
      (paragraph) =>
        `<p style="margin: 0 0 14px; font-size: 15px; line-height: 26px; color: #475569;">${escapeHtml(paragraph)}</p>`
    )
    .join("");

const renderFooter = () => `
  <p style="margin: 0; font-size: 12px; line-height: 20px; color: #94a3b8;">
    This email was sent by ${productName}. If you need help, reply to this email or contact
    <a href="mailto:${escapeHtml(supportEmail)}" style="color: #ea580c; text-decoration: none;">${escapeHtml(supportEmail)}</a>.
  </p>
`;

type BaseTemplateInput = {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string[];
  body: string;
  note?: string;
};

const renderLayout = ({ preheader, eyebrow, title, intro, body, note }: BaseTemplateInput) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f8fafc; font-family: Inter, Arial, sans-serif;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${escapeHtml(preheader)}</div>
      <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background: #f8fafc; padding: 24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width: 640px; margin: 0 auto;">
              <tr>
                <td style="padding: 0 20px 20px;">
                  <a href="${escapeHtml(webBaseUrl)}" style="text-decoration: none; color: #0f172a; font-size: 20px; font-weight: 700;">
                    ${productName}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 20px;">
                  <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);">
                    <tr>
                      <td style="padding: 28px 28px 12px;">
                        <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #f97316;">
                          ${escapeHtml(eyebrow)}
                        </p>
                        <h1 style="margin: 0; font-size: 30px; line-height: 38px; color: #0f172a; font-weight: 700;">
                          ${escapeHtml(title)}
                        </h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 28px 0;">
                        ${renderParagraphs(intro)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 18px 28px 0;">
                        ${body}
                      </td>
                    </tr>
                    ${
                      note
                        ? `<tr>
                            <td style="padding: 18px 28px 0;">
                              <div style="border-radius: 18px; border: 1px solid #fed7aa; background: #fff7ed; padding: 16px 18px;">
                                <p style="margin: 0; font-size: 13px; line-height: 22px; color: #9a3412;">${escapeHtml(note)}</p>
                              </div>
                            </td>
                          </tr>`
                        : ""
                    }
                    <tr>
                      <td style="padding: 24px 28px 28px;">
                        ${renderFooter()}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;

export const buildVerificationCodeEmail = ({
  fullName,
  code,
  expiresInMinutes
}: {
  fullName?: string | null;
  code: string;
  expiresInMinutes: number;
}) => {
  const greeting = fullName?.trim() ? `Hi ${fullName.trim()},` : "Hi,";
  const text = [
    greeting,
    "",
    "Use the verification code below to confirm your TraceForge account.",
    "",
    `Verification code: ${code}`,
    `Expires in: ${expiresInMinutes} minutes`,
    "",
    "If you did not create a TraceForge account, you can safely ignore this email."
  ].join("\n");

  const html = renderLayout({
    preheader: `Your TraceForge verification code is ${code}.`,
    eyebrow: "Verify your email",
    title: "Finish setting up your account",
    intro: [
      greeting,
      "Use the verification code below to confirm your email and continue into your TraceForge workspace."
    ],
    body: `
      <div style="border-radius: 20px; border: 1px solid #fed7aa; background: linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%); padding: 20px 22px; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #c2410c;">
          Verification code
        </p>
        <div style="font-size: 34px; line-height: 40px; font-weight: 800; letter-spacing: 0.28em; color: #9a3412;">
          ${escapeHtml(code)}
        </div>
        <p style="margin: 12px 0 0; font-size: 13px; line-height: 20px; color: #9a3412;">
          Expires in ${expiresInMinutes} minutes
        </p>
      </div>
    `,
    note: "If you did not create a TraceForge account, you can safely ignore this email."
  });

  return { text, html };
};

export const buildPasswordResetEmail = ({
  fullName,
  resetUrl
}: {
  fullName?: string | null;
  resetUrl: string;
}) => {
  const greeting = fullName?.trim() ? `Hi ${fullName.trim()},` : "Hi,";
  const text = [
    greeting,
    "",
    "We received a request to reset your TraceForge password.",
    `Reset password: ${resetUrl}`,
    "",
    "This link expires in 1 hour.",
    "If you did not request a reset, you can ignore this email."
  ].join("\n");

  const html = renderLayout({
    preheader: "Reset your TraceForge password.",
    eyebrow: "Password reset",
    title: "Reset your password",
    intro: [
      greeting,
      "We received a request to reset your TraceForge password. Use the secure link below to choose a new one."
    ],
    body: `
      <div style="border-radius: 20px; border: 1px solid #e2e8f0; background: #f8fafc; padding: 22px;">
        <a
          href="${escapeHtml(resetUrl)}"
          style="display: inline-block; border-radius: 16px; background: #f97316; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 20px;"
        >
          Reset password
        </a>
        <p style="margin: 16px 0 0; font-size: 13px; line-height: 22px; color: #64748b; word-break: break-all;">
          ${escapeHtml(resetUrl)}
        </p>
      </div>
    `,
    note: "This reset link expires in 1 hour. If you did not request a password reset, you can ignore this email."
  });

  return { text, html };
};

export const buildHelpRequestEmail = ({
  fromEmail,
  problem,
  ip,
  productUrl
}: {
  fromEmail: string;
  problem: string;
  ip: string;
  productUrl: string;
}) => {
  const text = [
    "TraceForge help request",
    "",
    `From: ${fromEmail}`,
    `IP: ${ip}`,
    `Product URL: ${productUrl}`,
    "",
    "Problem:",
    problem
  ].join("\n");

  const html = renderLayout({
    preheader: `New help request from ${fromEmail}.`,
    eyebrow: "Support request",
    title: "New help request received",
    intro: [
      "A user submitted a help request from the public support form.",
      "Use the details below to understand the issue and reply directly to the sender."
    ],
    body: `
      <div style="display: grid; gap: 14px;">
        <div style="border-radius: 18px; border: 1px solid #e2e8f0; background: #f8fafc; padding: 16px 18px;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b;">Sender</p>
          <p style="margin: 0; font-size: 15px; line-height: 24px; color: #0f172a;">${escapeHtml(fromEmail)}</p>
        </div>
        <div style="display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr));">
          <div style="border-radius: 18px; border: 1px solid #e2e8f0; background: #f8fafc; padding: 16px 18px;">
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b;">IP</p>
            <p style="margin: 0; font-size: 15px; line-height: 24px; color: #0f172a;">${escapeHtml(ip)}</p>
          </div>
          <div style="border-radius: 18px; border: 1px solid #e2e8f0; background: #f8fafc; padding: 16px 18px;">
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b;">Product URL</p>
            <p style="margin: 0; font-size: 15px; line-height: 24px; color: #0f172a;">${escapeHtml(productUrl)}</p>
          </div>
        </div>
        <div style="border-radius: 20px; border: 1px solid #fed7aa; background: linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%); padding: 18px 20px;">
          <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #c2410c;">Problem description</p>
          <p style="margin: 0; white-space: pre-wrap; font-size: 15px; line-height: 26px; color: #7c2d12;">${escapeHtml(problem)}</p>
        </div>
      </div>
    `,
    note: "Reply to this email to continue the support conversation with the sender."
  });

  return { text, html };
};

export const buildSuperAdminAccessRequestEmail = ({
  requesterEmail,
  requesterName,
  reason,
  productUrl
}: {
  requesterEmail: string;
  requesterName?: string | null;
  reason?: string | null;
  productUrl: string;
}) => {
  const text = [
    "TraceForge super admin access request",
    "",
    `Requester: ${requesterName?.trim() || "Unknown user"}`,
    `Email: ${requesterEmail}`,
    `Product URL: ${productUrl}`,
    "",
    "Reason:",
    reason?.trim() || "No additional reason provided."
  ].join("\n");

  const html = renderLayout({
    preheader: `Super admin access request from ${requesterEmail}.`,
    eyebrow: "Admin access",
    title: "New super admin access request",
    intro: [
      "A logged-in TraceForge user requested super admin access.",
      "Review the request below before deciding whether to add the sender to the super admin allowlist."
    ],
    body: `
      <div style="display: grid; gap: 14px;">
        <div style="display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr));">
          <div style="border-radius: 18px; border: 1px solid #e2e8f0; background: #f8fafc; padding: 16px 18px;">
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b;">Requester</p>
            <p style="margin: 0; font-size: 15px; line-height: 24px; color: #0f172a;">${escapeHtml(requesterName?.trim() || "Unknown user")}</p>
          </div>
          <div style="border-radius: 18px; border: 1px solid #e2e8f0; background: #f8fafc; padding: 16px 18px;">
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b;">Email</p>
            <p style="margin: 0; font-size: 15px; line-height: 24px; color: #0f172a;">${escapeHtml(requesterEmail)}</p>
          </div>
        </div>
        <div style="border-radius: 18px; border: 1px solid #e2e8f0; background: #f8fafc; padding: 16px 18px;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #64748b;">Workspace</p>
          <p style="margin: 0; font-size: 15px; line-height: 24px; color: #0f172a;">${escapeHtml(productUrl)}</p>
        </div>
        <div style="border-radius: 20px; border: 1px solid #fed7aa; background: linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%); padding: 18px 20px;">
          <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #c2410c;">Reason</p>
          <p style="margin: 0; white-space: pre-wrap; font-size: 15px; line-height: 26px; color: #7c2d12;">${escapeHtml(reason?.trim() || "No additional reason provided.")}</p>
        </div>
      </div>
    `,
    note: "Add the requester email to SUPER_ADMIN_EMAILS only if this access is approved."
  });

  return { text, html };
};
