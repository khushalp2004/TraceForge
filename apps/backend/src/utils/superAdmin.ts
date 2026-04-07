const DEFAULT_SUPER_ADMIN_EMAIL = "team@usetraceforge.com";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const getSuperAdminEmails = () => {
  const configured = (process.env.SUPER_ADMIN_EMAILS || DEFAULT_SUPER_ADMIN_EMAIL)
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);

  return configured.length ? configured : [DEFAULT_SUPER_ADMIN_EMAIL];
};

export const getSuperAdminInboxEmail = () =>
  normalizeEmail(
    process.env.SUPER_ADMIN_INBOX_EMAIL ||
      process.env.SUPPORT_INBOX_EMAIL ||
      getSuperAdminEmails()[0] ||
      DEFAULT_SUPER_ADMIN_EMAIL
  );

export const isSuperAdminEmail = (email?: string | null) =>
  Boolean(email && getSuperAdminEmails().includes(normalizeEmail(email)));
