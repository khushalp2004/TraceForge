export const FREE_MONTHLY_AI_LIMIT = 50;
export const TEAM_MONTHLY_AI_LIMIT = 200;

export const isUserProActive = (input?: {
  plan?: string | null;
  planExpiresAt?: Date | null;
} | null) =>
  input?.plan === "PRO" &&
  (!input.planExpiresAt || input.planExpiresAt.getTime() > Date.now());

export const isOrgTeamActive = (input?: {
  plan?: string | null;
  planExpiresAt?: Date | null;
} | null) =>
  input?.plan === "TEAM" &&
  (!input.planExpiresAt || input.planExpiresAt.getTime() > Date.now());
