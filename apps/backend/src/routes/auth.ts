import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimitByIp, rateLimitByUser } from "../middleware/rateLimit.js";
import { signToken } from "../utils/jwt.js";
import { encryptIntegrationSecret } from "../utils/integrationSecrets.js";
import {
  DEV_MONTHLY_AI_LIMIT,
  FREE_MONTHLY_AI_LIMIT,
  TEAM_MONTHLY_AI_LIMIT,
  isUserDevActive,
  isOrgTeamActive,
  isUserProActive
} from "../utils/billing.js";
import { getEffectiveAiUsage } from "../utils/aiUsage.js";
import { isSuperAdminEmail } from "../utils/superAdmin.js";
import { deleteUserAccount, UserLifecycleError } from "../utils/userLifecycle.js";
import {
  findActiveVerificationCode,
  isVerificationCodeMatch,
  issueEmailVerificationCode
} from "../utils/emailVerification.js";
import { clearAuthCookie, setAuthCookie } from "../utils/authCookies.js";

export const authRouter = Router();

const registerRateLimit = rateLimitByIp("auth:register", {
  windowSeconds: 15 * 60,
  maxRequests: 8,
  message: "Too many sign up attempts. Please try again shortly."
});
const loginRateLimit = rateLimitByIp("auth:login", {
  windowSeconds: 10 * 60,
  maxRequests: 10,
  message: "Too many sign in attempts. Please try again shortly."
});
const socialStartRateLimit = rateLimitByIp("auth:social-start", {
  windowSeconds: 10 * 60,
  maxRequests: 20,
  message: "Too many OAuth attempts. Please try again shortly."
});
const socialCompleteRateLimit = rateLimitByIp("auth:social-complete", {
  windowSeconds: 15 * 60,
  maxRequests: 10,
  message: "Too many social signup attempts. Please try again shortly."
});
const verifyCodeRateLimit = rateLimitByIp("auth:verify-email", {
  windowSeconds: 10 * 60,
  maxRequests: 10,
  message: "Too many verification attempts. Please wait before trying again."
});
const resendVerificationRateLimit = rateLimitByIp("auth:verify-email-resend", {
  windowSeconds: 10 * 60,
  maxRequests: 5,
  message: "Too many resend requests. Please wait before trying again."
});
const accountMutationRateLimit = rateLimitByUser("auth:account-mutation", {
  windowSeconds: 5 * 60,
  maxRequests: 20,
  message: "Too many account changes. Please wait and try again."
});

const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
const passwordPolicy =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{10,64}$/;
const passwordPolicyMessage =
  "Password must be 10-64 characters and include uppercase, lowercase, number, and special character.";
const isStrongEnoughPassword = (password: string) => passwordPolicy.test(password);
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const jwtSecret = process.env.JWT_SECRET || "";
const frontendUrl = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "http://localhost:3000";
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || "";
type SocialAuthMode = "login" | "signup";
type SocialProvider = "google" | "github";

type SocialOauthState = {
  purpose: "social_oauth_state";
  provider: SocialProvider;
  mode: SocialAuthMode;
  next: string;
};

type SocialSignupToken = {
  purpose: "social_signup";
  provider: SocialProvider;
  email: string;
  displayName: string;
  next: string;
};

type IntegrationOauthState = {
  purpose: "integration_oauth";
  provider: "github";
  userId: string;
  returnTo: string;
};

const githubClientId = process.env.GITHUB_CLIENT_ID || "";
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || "";
const githubRedirectUri = process.env.GITHUB_REDIRECT_URI || "";

const isGithubOAuthConfigured = () =>
  Boolean(jwtSecret && githubClientId && githubClientSecret && githubRedirectUri);

const isSocialOAuthConfigured = (provider: SocialProvider) =>
  provider === "google" ? isGoogleOAuthConfigured() : isGithubOAuthConfigured();

const isGoogleOAuthConfigured = () =>
  Boolean(jwtSecret && googleClientId && googleClientSecret && googleRedirectUri);

const normalizeNextPath = (value: string | undefined) =>
  value && value.startsWith("/") ? value : "/dashboard";

const buildFrontendRedirect = (path: string, params: Record<string, string | undefined>) => {
  const url = new URL(path, frontendUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
};

const serializeAuthUser = (user: {
  id: string;
  fullName?: string | null;
  address?: string | null;
  email: string;
  plan?: string | null;
  planExpiresAt?: Date | null;
  planInterval?: string | null;
  proPricingTier?: string | null;
  subscriptionStatus?: string | null;
}) => ({
  id: user.id,
  fullName: user.fullName ?? null,
  address: user.address ?? null,
  email: user.email,
  plan: user.plan ?? "FREE",
  planInterval: user.planInterval ?? null,
  proPricingTier: user.proPricingTier ?? null,
  planExpiresAt: user.planExpiresAt ?? null,
  subscriptionStatus: user.subscriptionStatus ?? null,
  isSuperAdmin: isSuperAdminEmail(user.email)
});

const createSessionResponse = (
  res: Parameters<typeof setAuthCookie>[0],
  user: {
    id: string;
    fullName?: string | null;
    address?: string | null;
    email: string;
    plan?: string | null;
    planInterval?: string | null;
    proPricingTier?: string | null;
    planExpiresAt?: Date | null;
    subscriptionStatus?: string | null;
  },
  extra: Record<string, unknown> = {}
) => {
  const token = signToken({ sub: user.id, email: user.email });
  setAuthCookie(res, token);

  return {
    token: "cookie-session",
    user: serializeAuthUser(user),
    ...extra
  };
};

const buildGoogleAuthUrl = (mode: SocialAuthMode, next: string) => {
  const state = jwt.sign(
    {
      purpose: "social_oauth_state",
      provider: "google",
      mode,
      next
    } satisfies SocialOauthState,
    jwtSecret,
    { expiresIn: "10m" }
  );

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", googleClientId);
  url.searchParams.set("redirect_uri", googleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);
  return url.toString();
};

const buildGithubAuthUrl = (mode: SocialAuthMode, next: string) => {
  const state = jwt.sign(
    {
      purpose: "social_oauth_state",
      provider: "github",
      mode,
      next
    } satisfies SocialOauthState,
    jwtSecret,
    { expiresIn: "10m" }
  );

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", githubClientId);
  url.searchParams.set("redirect_uri", githubRedirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return url.toString();
};

const exchangeGoogleCode = async (code: string) => {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
      redirect_uri: googleRedirectUri,
      grant_type: "authorization_code"
    })
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to exchange Google code");
  }

  return data.access_token;
};

const fetchGoogleProfile = async (accessToken: string) => {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = (await response.json().catch(() => ({}))) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  };

  if (!response.ok || !data.email) {
    throw new Error("Failed to fetch Google profile");
  }

  return data;
};

const exchangeGithubCode = async (code: string) => {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: githubClientId,
      client_secret: githubClientSecret,
      code,
      redirect_uri: githubRedirectUri
    })
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to exchange GitHub code");
  }

  return data.access_token;
};

const fetchGithubProfile = async (accessToken: string) => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  const [userResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers })
  ]);

  const userData = (await userResponse.json().catch(() => ({}))) as {
    id?: number;
    name?: string | null;
    login?: string;
    email?: string | null;
  };
  const emailData = (await emailsResponse.json().catch(() => [])) as Array<{
    email: string;
    primary?: boolean;
    verified?: boolean;
  }>;

  const verifiedEmail =
    emailData.find((entry) => entry.primary && entry.verified)?.email ||
    emailData.find((entry) => entry.verified)?.email ||
    userData.email ||
    "";

  if (!userResponse.ok || !emailsResponse.ok || !verifiedEmail || !userData.id || !userData.login) {
    throw new Error("Failed to fetch GitHub profile");
  }

  return {
    id: String(userData.id),
    login: userData.login,
    email: verifiedEmail,
    name: userData.name?.trim() || userData.login || ""
  };
};

const resolveSocialSignupRedirect = async ({
  provider,
  mode,
  next,
  email,
  displayName
}: {
  provider: SocialProvider;
  mode: SocialAuthMode;
  next: string;
  email: string;
  displayName: string;
}): Promise<
  {
    redirectUrl: string;
    authUser?: {
      id: string;
      fullName?: string | null;
      address?: string | null;
      email: string;
      plan?: string | null;
      planInterval?: string | null;
      proPricingTier?: string | null;
      planExpiresAt?: Date | null;
      subscriptionStatus?: string | null;
    };
  }
> => {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (mode === "login") {
    if (!existingUser) {
      return {
        redirectUrl: buildFrontendRedirect("/signin", {
          oauthError: `${provider}_no_account`,
          email: normalizedEmail
        })
      };
    }

    if (existingUser.disabledAt) {
      return {
        redirectUrl: buildFrontendRedirect("/signin", {
          oauthError: "account_disabled"
        })
      };
    }

    const verifiedUser = existingUser.emailVerifiedAt
      ? existingUser
      : await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerifiedAt: new Date() }
        });

    return {
      redirectUrl: buildFrontendRedirect("/oauth/complete", {
        next,
        mode: "login",
        provider
      }),
      authUser: verifiedUser
    };
  }

  if (existingUser?.fullName?.trim() && existingUser.address?.trim()) {
    if (existingUser.disabledAt) {
      return {
        redirectUrl: buildFrontendRedirect("/signin", {
          oauthError: "account_disabled"
        })
      };
    }

    const verifiedUser = existingUser.emailVerifiedAt
      ? existingUser
      : await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerifiedAt: new Date() }
        });

    return {
      redirectUrl: buildFrontendRedirect("/oauth/complete", {
        next,
        mode: "signup",
        provider
      }),
      authUser: verifiedUser
    };
  }

  const signupToken = jwt.sign(
    {
      purpose: "social_signup",
      provider,
      email: normalizedEmail,
      displayName,
      next
    } satisfies SocialSignupToken,
    jwtSecret,
    { expiresIn: "20m" }
  );

  return {
    redirectUrl: buildFrontendRedirect("/signup", {
      socialProvider: provider,
      socialSignupToken: signupToken,
      email: normalizedEmail,
      fullName: displayName,
      next
    })
  };
};

authRouter.get("/me", requireAuth, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      address: true,
      email: true,
      emailVerifiedAt: true,
      plan: true,
      planInterval: true,
      proPricingTier: true,
      planExpiresAt: true,
      subscriptionStatus: true
    }
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ user: serializeAuthUser(user) });
});

authRouter.get("/usage", requireAuth, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const organizationId =
    typeof req.query.orgId === "string" && req.query.orgId.trim()
      ? req.query.orgId.trim()
      : null;

  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      plan: true,
      planExpiresAt: true
    }
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (isUserProActive(user)) {
    return res.json({
      usage: {
        scope: "USER",
        plan: "PRO",
        used: 0,
        limit: null,
        remaining: null,
        percentUsed: 0,
        label: "Unlimited AI",
        detail: "Unlimited AI analyses on your Pro plan."
      }
    });
  }

  if (isUserDevActive(user)) {
    const devLimit = DEV_MONTHLY_AI_LIMIT;
    const devUsed = await getEffectiveAiUsage({
      userId,
      now
    });
    const safeDevUsed = Math.max(0, devUsed);
    const devRemaining = Math.max(0, devLimit - safeDevUsed);

    return res.json({
      usage: {
        scope: "USER",
        plan: "DEV",
        used: safeDevUsed,
        limit: devLimit,
        remaining: devRemaining,
        percentUsed: Math.min(100, Math.round((safeDevUsed / devLimit) * 100)),
        label: `${devRemaining} left`,
        detail: `${safeDevUsed} of ${devLimit} AI analyses used this month on your Dev plan.`
      }
    });
  }

  if (organizationId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      },
      select: { role: true }
    });

    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this organization" });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        plan: true,
        planExpiresAt: true
      }
    });

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    if (isOrgTeamActive(organization)) {
      const limit = TEAM_MONTHLY_AI_LIMIT;
      const used = await getEffectiveAiUsage({
        userId,
        organizationId,
        now
      });

      const safeUsed = Math.max(0, used);
      const remaining = Math.max(0, limit - safeUsed);
      return res.json({
        usage: {
          scope: "ORGANIZATION",
          plan: "TEAM",
          used: safeUsed,
          limit,
          remaining,
          percentUsed: Math.min(100, Math.round((safeUsed / limit) * 100)),
          label: `${remaining} left`,
          detail: `${safeUsed} of ${limit} AI analyses used this month for ${organization.name}.`
        }
      });
    }
  }

  const freeLimit = FREE_MONTHLY_AI_LIMIT;
  const freeUsed = await getEffectiveAiUsage({
    userId,
    email: user.email,
    now
  });

  const safeFreeUsed = Math.max(0, freeUsed);
  const freeRemaining = Math.max(0, freeLimit - safeFreeUsed);

  return res.json({
    usage: {
      scope: "USER",
      plan: "FREE",
      used: safeFreeUsed,
      limit: freeLimit,
      remaining: freeRemaining,
      percentUsed: Math.min(100, Math.round((safeFreeUsed / freeLimit) * 100)),
      label: `${freeRemaining} left`,
      detail: `${safeFreeUsed} of ${freeLimit} AI analyses used this month on your free plan.`
    }
  });
});

authRouter.post("/register", registerRateLimit, async (req, res) => {
  const { fullName, address, email, password } = req.body as {
    fullName?: string;
    address?: string;
    email?: string;
    password?: string;
  };

  if (!fullName?.trim() || !address?.trim() || !email || !password || !isValidEmail(email)) {
    return res.status(400).json({
      error: "Full name, address, valid email, and password are required"
    });
  }

  if (!isStrongEnoughPassword(password)) {
    return res.status(400).json({ error: passwordPolicyMessage });
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing?.disabledAt) {
    return res.status(403).json({ error: "This account has been suspended. Contact support for help." });
  }
  if (existing?.emailVerifiedAt) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: fullName.trim(),
          address: address.trim(),
          email: normalizedEmail,
          passwordHash
        }
      })
    : await prisma.user.create({
        data: {
          fullName: fullName.trim(),
          address: address.trim(),
          email: normalizedEmail,
          passwordHash
        }
      });

  await issueEmailVerificationCode({
    userId: user.id,
    email: user.email,
    fullName: user.fullName
  });

  return res.status(201).json({
    status: "verification_required",
    email: user.email
  });
});

authRouter.post("/login", loginRateLimit, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (user.disabledAt) {
    return res.status(403).json({ error: "This account has been suspended. Contact support for help." });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!user.emailVerifiedAt) {
    return res.status(403).json({
      error: "Verify your email before signing in",
      verificationRequired: true,
      email: user.email
    });
  }

  return res.json(createSessionResponse(res, user));
});

authRouter.get("/google/start", socialStartRateLimit, async (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    return res.status(503).json({ error: "Google OAuth is not configured" });
  }

  const mode = req.query.mode === "signup" ? "signup" : "login";
  const next = normalizeNextPath(
    typeof req.query.next === "string" ? req.query.next : undefined
  );

  return res.redirect(buildGoogleAuthUrl(mode, next));
});

authRouter.get("/google/callback", async (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(
      buildFrontendRedirect("/signin", {
        oauthError: "google_not_configured"
      })
    );
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";

  if (!code || !state) {
    return res.redirect(
      buildFrontendRedirect("/signin", {
        oauthError: "google_callback_invalid"
      })
    );
  }

  let parsedState: SocialOauthState;

  try {
    const rawState = jwt.verify(state, jwtSecret) as
      | SocialOauthState
      | { purpose: "google_oauth_state"; mode: SocialAuthMode; next: string };

    parsedState =
      rawState.purpose === "google_oauth_state"
        ? {
            purpose: "social_oauth_state",
            provider: "google",
            mode: rawState.mode,
            next: rawState.next
          }
        : rawState;
  } catch {
    return res.redirect(
      buildFrontendRedirect("/signin", {
        oauthError: "google_state_invalid"
      })
    );
  }

  if (parsedState.purpose !== "social_oauth_state" || parsedState.provider !== "google") {
    return res.redirect(
      buildFrontendRedirect("/signin", {
        oauthError: "google_state_invalid"
      })
    );
  }

  try {
    const accessToken = await exchangeGoogleCode(code);
    const googleProfile = await fetchGoogleProfile(accessToken);

    if (!googleProfile.email_verified || !googleProfile.email) {
      return res.redirect(
        buildFrontendRedirect(
          parsedState.mode === "signup" ? "/signup" : "/signin",
          {
            oauthError: "google_email_unverified"
          }
        )
      );
    }

    const socialResult = await resolveSocialSignupRedirect({
      provider: "google",
      mode: parsedState.mode,
      next: parsedState.next,
      email: googleProfile.email,
      displayName: googleProfile.name?.trim() || ""
    });

    if (socialResult.authUser) {
      createSessionResponse(res, socialResult.authUser);
    }

    return res.redirect(socialResult.redirectUrl);
  } catch {
    return res.redirect(
      buildFrontendRedirect(
        parsedState.mode === "signup" ? "/signup" : "/signin",
        {
          oauthError: "google_auth_failed"
        }
      )
    );
  }
});

authRouter.post("/github/integration/start", requireAuth, async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isGithubOAuthConfigured()) {
    return res.status(503).json({ error: "GitHub integration is not configured" });
  }

  const state = jwt.sign(
    {
      purpose: "integration_oauth",
      provider: "github",
      userId,
      returnTo: "/dashboard/settings"
    } satisfies IntegrationOauthState,
    jwtSecret,
    { expiresIn: "10m" }
  );

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", githubClientId);
  url.searchParams.set("redirect_uri", githubRedirectUri);
  url.searchParams.set("scope", "read:user user:email repo read:org");
  url.searchParams.set("state", state);

  return res.json({ url: url.toString() });
});

authRouter.get("/github/start", socialStartRateLimit, async (req, res) => {
  if (!isGithubOAuthConfigured()) {
    return res.status(503).json({ error: "GitHub OAuth is not configured" });
  }

  const mode = req.query.mode === "signup" ? "signup" : "login";
  const next = normalizeNextPath(
    typeof req.query.next === "string" ? req.query.next : undefined
  );

  return res.redirect(buildGithubAuthUrl(mode, next));
});

authRouter.get("/github/callback", async (req, res) => {
  if (!isGithubOAuthConfigured()) {
    return res.redirect(
      buildFrontendRedirect("/signin", {
        oauthError: "github_not_configured"
      })
    );
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";

  if (!code || !state) {
    return res.redirect(
      buildFrontendRedirect("/signin", {
        oauthError: "github_callback_invalid"
      })
    );
  }

  let parsedState: SocialOauthState | IntegrationOauthState;

  try {
    parsedState = jwt.verify(state, jwtSecret) as SocialOauthState | IntegrationOauthState;
  } catch {
    return res.redirect(
      buildFrontendRedirect("/signin", {
        oauthError: "github_state_invalid"
      })
    );
  }

  if (parsedState.provider !== "github") {
    return res.redirect(
      buildFrontendRedirect("/signin", {
        oauthError: "github_state_invalid"
      })
    );
  }

  try {
    const accessToken = await exchangeGithubCode(code);
    const githubProfile = await fetchGithubProfile(accessToken);

    if (parsedState.purpose === "integration_oauth") {
      const existingConnection = await prisma.integrationConnection.findUnique({
        where: {
          provider_userId: {
            provider: "GITHUB",
            userId: parsedState.userId
          }
        }
      });

      const existingMetadata =
        existingConnection?.metadata &&
        typeof existingConnection.metadata === "object" &&
        !Array.isArray(existingConnection.metadata)
          ? (existingConnection.metadata as Record<string, unknown>)
          : {};

      await prisma.integrationConnection.upsert({
        where: {
          provider_userId: {
            provider: "GITHUB",
            userId: parsedState.userId
          }
        },
        update: {
          scope: "USER",
          status: "CONNECTED",
          externalAccountId: githubProfile.id,
          externalAccountName: githubProfile.name,
          accessTokenEncrypted: encryptIntegrationSecret(accessToken),
          metadata: {
            ...(existingMetadata as Record<string, unknown>),
            login: githubProfile.login
          } as Prisma.InputJsonValue,
          lastSyncedAt: new Date()
        },
        create: {
          provider: "GITHUB",
          scope: "USER",
          userId: parsedState.userId,
          status: "CONNECTED",
          externalAccountId: githubProfile.id,
          externalAccountName: githubProfile.name,
          accessTokenEncrypted: encryptIntegrationSecret(accessToken),
          metadata: {
            login: githubProfile.login,
            selectedRepoIds: []
          } as Prisma.InputJsonValue,
          lastSyncedAt: new Date()
        }
      });

      return res.redirect(
        buildFrontendRedirect(parsedState.returnTo || "/dashboard/settings", {
          integration: "github",
          integrationStatus: "connected"
        })
      );
    }

    const socialResult = await resolveSocialSignupRedirect({
      provider: "github",
      mode: parsedState.mode,
      next: parsedState.next,
      email: githubProfile.email,
      displayName: githubProfile.name
    });

    if (socialResult.authUser) {
      createSessionResponse(res, socialResult.authUser);
    }

    return res.redirect(socialResult.redirectUrl);
  } catch {
    if (parsedState.purpose === "integration_oauth") {
      return res.redirect(
        buildFrontendRedirect(parsedState.returnTo || "/dashboard/settings", {
          integration: "github",
          integrationStatus: "error",
          integrationMessage: "GitHub connection failed"
        })
      );
    }

    return res.redirect(
      buildFrontendRedirect(
        parsedState.mode === "signup" ? "/signup" : "/signin",
        {
          oauthError: "github_auth_failed"
        }
      )
    );
  }
});

authRouter.post("/oauth/complete-signup", socialCompleteRateLimit, async (req, res) => {
  const { signupToken, fullName, address, password } = req.body as {
    signupToken?: string;
    fullName?: string;
    address?: string;
    password?: string;
  };

  if (!signupToken || !address?.trim() || !password) {
    return res.status(400).json({ error: "Address, password, and signup token are required" });
  }

  if (!isStrongEnoughPassword(password)) {
    return res.status(400).json({ error: passwordPolicyMessage });
  }

  let payload: SocialSignupToken;

  try {
    payload = jwt.verify(signupToken, jwtSecret) as SocialSignupToken;
  } catch {
    return res.status(400).json({ error: "Social signup session expired. Please try again." });
  }

  if (payload.purpose !== "social_signup") {
    return res.status(400).json({ error: "Social signup session expired. Please try again." });
  }

  const normalizedEmail = normalizeEmail(payload.email);
  const resolvedName = fullName?.trim() || payload.displayName?.trim();

  if (!resolvedName) {
    return res.status(400).json({ error: "Full name is required" });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });
  const passwordHash = await bcrypt.hash(password, 12);

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName: resolvedName,
          address: address.trim(),
          passwordHash,
          emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date()
        }
      })
    : await prisma.user.create({
        data: {
          fullName: resolvedName,
          address: address.trim(),
          email: normalizedEmail,
          passwordHash,
          emailVerifiedAt: new Date()
        }
      });

  if (user.disabledAt) {
    return res.status(403).json({ error: "This account has been suspended. Contact support for help." });
  }

  return res.json(
    createSessionResponse(res, user, {
      next: payload.next
    })
  );
});

authRouter.post("/verify-email", verifyCodeRateLimit, async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string };

  if (!email || !code) {
    return res.status(400).json({ error: "Email and verification code are required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    return res.status(400).json({ error: "Invalid verification code" });
  }

  if (user.disabledAt) {
    return res.status(403).json({ error: "This account has been suspended. Contact support for help." });
  }

  if (user.emailVerifiedAt) {
    return res.json(
      createSessionResponse(res, user, {
        status: "already_verified"
      })
    );
  }

  const activeCode = await findActiveVerificationCode(user.id);
  if (!activeCode || activeCode.expiresAt < new Date()) {
    return res.status(400).json({ error: "The verification code is invalid or expired" });
  }

  if (!isVerificationCodeMatch(code.trim(), activeCode.codeHash)) {
    return res.status(400).json({ error: "The verification code is invalid or expired" });
  }

  await prisma.$transaction([
    prisma.emailVerificationCode.update({
      where: { id: activeCode.id },
      data: { usedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() }
    })
  ]);

  return res.json(
    createSessionResponse(res, user, {
      status: "verified"
    })
  );
});

authRouter.post("/logout", async (_req, res) => {
  clearAuthCookie(res);
  return res.json({ status: "ok" });
});

authRouter.post("/verify-email/resend", resendVerificationRateLimit, async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user) {
    return res.json({ status: "ok" });
  }

  if (user.disabledAt) {
    return res.status(403).json({ error: "This account has been suspended. Contact support for help." });
  }

  if (user.emailVerifiedAt) {
    return res.status(409).json({ error: "This email is already verified" });
  }

  await issueEmailVerificationCode({
    userId: user.id,
    email: user.email,
    fullName: user.fullName
  });

  return res.json({ status: "ok" });
});

authRouter.patch("/profile", requireAuth, accountMutationRateLimit, async (req, res) => {
  const userId = req.user?.id;
  const { fullName, address } = req.body as {
    fullName?: string;
    address?: string;
  };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!fullName?.trim() || !address?.trim()) {
    return res.status(400).json({ error: "Full name and address are required" });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: fullName.trim(),
      address: address.trim()
    },
    select: {
      id: true,
      fullName: true,
      address: true,
      email: true
    }
  });

  return res.json({ status: "ok", user });
});

authRouter.post("/change-password", requireAuth, accountMutationRateLimit, async (req, res) => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }

  if (!isStrongEnoughPassword(newPassword)) {
    return res.status(400).json({ error: passwordPolicyMessage });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  return res.json({ status: "ok" });
});

authRouter.post("/leave-organizations", requireAuth, accountMutationRateLimit, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: {
      organization: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!memberships.length) {
    return res.json({ status: "ok", left: 0 });
  }

  const blockingOrganizations: string[] = [];

  for (const membership of memberships) {
    if (membership.role !== "OWNER") {
      continue;
    }

    const ownerCount = await prisma.organizationMember.count({
      where: {
        organizationId: membership.organizationId,
        role: "OWNER"
      }
    });

    if (ownerCount <= 1) {
      blockingOrganizations.push(membership.organization.name);
    }
  }

  if (blockingOrganizations.length) {
    return res.status(409).json({
      error:
        "You are the only owner in one or more organizations. Add another owner or delete those organizations first.",
      blockers: blockingOrganizations
    });
  }

  await prisma.organizationMember.deleteMany({
    where: { userId }
  });

  return res.json({ status: "ok", left: memberships.length });
});

authRouter.delete("/account", requireAuth, accountMutationRateLimit, async (req, res) => {
  const userId = req.user?.id;
  const { email, password } = req.body as { email?: string; password?: string };

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password confirmation are required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      plan: true,
      planExpiresAt: true
    }
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (user.email !== email) {
    return res.status(400).json({ error: "Email confirmation does not match this account" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Password confirmation is incorrect" });
  }

  try {
    await deleteUserAccount(userId);
    clearAuthCookie(res);
    return res.json({ status: "deleted" });
  } catch (error) {
    if (error instanceof UserLifecycleError) {
      return res.status(error.status).json({
        error: error.message,
        ...(error.blockers ? { blockers: error.blockers } : {})
      });
    }

    throw error;
  }
});
