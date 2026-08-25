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
        `<p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: #374151;">${escapeHtml(paragraph)}</p>`
    )
    .join("");

const renderFooter = () => `
  <p style="margin: 0; font-size: 13px; line-height: 20px; color: #9ca3af; text-align: center;">
    This email was sent by ${productName}. If you need help, reply to this email or contact
    <a href="mailto:${escapeHtml(supportEmail)}" style="color: #6b7280; text-decoration: underline;">${escapeHtml(supportEmail)}</a>.
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
    <body style="margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${escapeHtml(preheader)}</div>
      <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background: #f9fafb; padding: 40px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="max-width: 560px; margin: 0 auto;">
              <tr>
                <td align="center" style="padding: 0 0 32px 0;">
                  <a href="${escapeHtml(webBaseUrl)}" style="text-decoration: none; color: #111827; font-size: 24px; font-weight: 800; letter-spacing: -0.05em;">
                    ${productName}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 16px;">
                  <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
                    <tr>
                      <td style="padding: 40px 40px 32px;">
                        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">
                          ${escapeHtml(eyebrow)}
                        </p>
                        <h1 style="margin: 0 0 24px; font-size: 24px; line-height: 32px; color: #111827; font-weight: 700; letter-spacing: -0.02em;">
                          ${escapeHtml(title)}
                        </h1>
                        ${renderParagraphs(intro)}
                        ${body}
                      </td>
                    </tr>
                    ${
                      note
                        ? `<tr>
                            <td style="padding: 0 40px 32px;">
                              <div style="border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; padding: 16px 20px;">
                                <p style="margin: 0; font-size: 14px; line-height: 22px; color: #4b5563;">${escapeHtml(note)}</p>
                              </div>
                            </td>
                          </tr>`
                        : ""
                    }
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px 20px;">
                  ${renderFooter()}
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
      <div style="border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; padding: 24px; text-align: center; margin: 32px 0;">
        <p style="margin: 0 0 12px; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">
          Verification code
        </p>
        <div style="font-size: 36px; line-height: 42px; font-weight: 700; letter-spacing: 0.25em; color: #111827; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
          ${escapeHtml(code)}
        </div>
        <p style="margin: 12px 0 0; font-size: 13px; line-height: 20px; color: #6b7280;">
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
      <div style="margin: 32px 0;">
        <a
          href="${escapeHtml(resetUrl)}"
          style="display: inline-block; border-radius: 6px; background: #111827; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px;"
        >
          Reset password
        </a>
        <p style="margin: 16px 0 0; font-size: 13px; line-height: 20px; color: #6b7280; word-break: break-all;">
          Or copy and paste this link: <br/>
          <a href="${escapeHtml(resetUrl)}" style="color: #4b5563;">${escapeHtml(resetUrl)}</a>
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
      <div style="margin: 24px 0; border-top: 1px solid #e5e7eb; padding-top: 24px; display: grid; gap: 16px;">
        <div>
          <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">Sender</p>
          <p style="margin: 0; font-size: 15px; line-height: 24px; color: #111827;">${escapeHtml(fromEmail)}</p>
        </div>
        <div>
          <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">IP</p>
          <p style="margin: 0; font-size: 15px; line-height: 24px; color: #111827;">${escapeHtml(ip)}</p>
        </div>
        <div>
          <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">Product URL</p>
          <p style="margin: 0; font-size: 15px; line-height: 24px; color: #111827;">${escapeHtml(productUrl)}</p>
        </div>
        <div style="border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; padding: 20px; margin-top: 8px;">
          <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">Problem description</p>
          <p style="margin: 0; white-space: pre-wrap; font-size: 15px; line-height: 24px; color: #111827;">${escapeHtml(problem)}</p>
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
      <div style="margin: 24px 0; border-top: 1px solid #e5e7eb; padding-top: 24px; display: grid; gap: 16px;">
        <div style="display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr));">
          <div>
            <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">Requester</p>
            <p style="margin: 0; font-size: 15px; line-height: 24px; color: #111827;">${escapeHtml(requesterName?.trim() || "Unknown user")}</p>
          </div>
          <div>
            <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">Email</p>
            <p style="margin: 0; font-size: 15px; line-height: 24px; color: #111827;">${escapeHtml(requesterEmail)}</p>
          </div>
        </div>
        <div>
          <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">Workspace</p>
          <p style="margin: 0; font-size: 15px; line-height: 24px; color: #111827;">${escapeHtml(productUrl)}</p>
        </div>
        <div style="border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; padding: 20px; margin-top: 8px;">
          <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #6b7280;">Reason</p>
          <p style="margin: 0; white-space: pre-wrap; font-size: 15px; line-height: 24px; color: #111827;">${escapeHtml(reason?.trim() || "No additional reason provided.")}</p>
        </div>
      </div>
    `,
    note: "Add the requester email to SUPER_ADMIN_EMAILS only if this access is approved."
  });

  return { text, html };
};

export const buildMarketingAnnouncementEmail = ({
  subject,
  message
}: {
  subject: string;
  message: string;
}) => {
  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();
  const paragraphs = cleanMessage
    .split(/\n\s*\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const text = [cleanSubject, "", ...paragraphs, "", `Open TraceForge: ${webBaseUrl}`].join("\n");

  const html = renderLayout({
    preheader: cleanSubject,
    eyebrow: "Product update",
    title: cleanSubject,
    intro: [
      "Here’s a quick update from TraceForge.",
      "We’re sharing this with subscribers who asked to hear about product updates and launch offers."
    ],
    body: `
      <div style="display: grid; gap: 12px; margin-top: 24px;">
        ${paragraphs
          .map(
            (paragraph) => `
              <div style="border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; padding: 16px 20px;">
                <p style="margin: 0; white-space: pre-wrap; font-size: 15px; line-height: 24px; color: #374151;">${escapeHtml(paragraph)}</p>
              </div>
            `
          )
          .join("")}
        <div style="padding-top: 12px;">
          <a
            href="${escapeHtml(webBaseUrl)}"
            style="display: inline-block; border-radius: 6px; background: #111827; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px;"
          >
            Open TraceForge
          </a>
        </div>
      </div>
    `,
    note: "You received this because you subscribed to TraceForge product updates."
  });

  return { text, html };
};
