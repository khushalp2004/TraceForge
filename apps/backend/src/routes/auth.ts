import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { requireAuth } from "../middleware/auth.js";
import { signToken } from "../utils/jwt.js";
import { encryptIntegrationSecret } from "../utils/integrationSecrets.js";
import {
  FREE_MONTHLY_AI_LIMIT,
  TEAM_MONTHLY_AI_LIMIT,
  isOrgTeamActive,
  isUserProActive
} from "../utils/billing.js";
import { ensureFreeEmailUsageFloor, getEffectiveAiUsage } from "../utils/aiUsage.js";
import {
  findActiveVerificationCode,
  isVerificationCodeMatch,
  issueEmailVerificationCode
} from "../utils/emailVerification.js";

export const authRouter = Router();

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
const chooseTransferTarget = (
  members: Array<{ userId: string; role: "OWNER" | "MEMBER" }>
) => members.find((member) => member.role === "OWNER") ?? members[0] ?? null;

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
}) => {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (mode === "login") {
    if (!existingUser) {
      return buildFrontendRedirect("/signin", {
        oauthError: `${provider}_no_account`,
        email: normalizedEmail
      });
    }

    const verifiedUser = existingUser.emailVerifiedAt
      ? existingUser
      : await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerifiedAt: new Date() }
        });

    const token = signToken({ sub: verifiedUser.id, email: verifiedUser.email });
    return buildFrontendRedirect("/oauth/complete", {
      token,
      next,
      mode: "login",
      provider
    });
  }

  if (existingUser?.fullName?.trim() && existingUser.address?.trim()) {
    const verifiedUser = existingUser.emailVerifiedAt
      ? existingUser
      : await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerifiedAt: new Date() }
        });

    const token = signToken({ sub: verifiedUser.id, email: verifiedUser.email });
    return buildFrontendRedirect("/oauth/complete", {
      token,
      next,
      mode: "signup",
      provider
    });
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

  return buildFrontendRedirect("/signup", {
    socialProvider: provider,
    socialSignupToken: signupToken,
    email: normalizedEmail,
    fullName: displayName,
    next
  });
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

  return res.json({ user });
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

authRouter.post("/register", async (req, res) => {
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

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
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

  const token = signToken({ sub: user.id, email: user.email });

  return res.json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      address: user.address,
      email: user.email,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt
    }
  });
});

authRouter.get("/google/start", async (req, res) => {
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

    return res.redirect(
      await resolveSocialSignupRedirect({
        provider: "google",
        mode: parsedState.mode,
        next: parsedState.next,
        email: googleProfile.email,
        displayName: googleProfile.name?.trim() || ""
      })
    );
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

authRouter.get("/github/start", async (req, res) => {
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

    return res.redirect(
      await resolveSocialSignupRedirect({
        provider: "github",
        mode: parsedState.mode,
        next: parsedState.next,
        email: githubProfile.email,
        displayName: githubProfile.name
      })
    );
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

authRouter.post("/oauth/complete-signup", async (req, res) => {
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

  const token = signToken({ sub: user.id, email: user.email });

  return res.json({
    token,
    next: payload.next,
    user: {
      id: user.id,
      fullName: user.fullName,
      address: user.address,
      email: user.email,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt
    }
  });
});

authRouter.post("/verify-email", async (req, res) => {
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

  if (user.emailVerifiedAt) {
    const token = signToken({ sub: user.id, email: user.email });

    return res.json({
      status: "already_verified",
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        address: user.address,
        email: user.email,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt
      }
    });
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

  const token = signToken({ sub: user.id, email: user.email });

  return res.json({
    status: "verified",
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      address: user.address,
      email: user.email,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt
    }
  });
});

authRouter.post("/verify-email/resend", async (req, res) => {
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

authRouter.patch("/profile", requireAuth, async (req, res) => {
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

authRouter.post("/change-password", requireAuth, async (req, res) => {
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

authRouter.post("/leave-organizations", requireAuth, async (req, res) => {
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

authRouter.delete("/account", requireAuth, async (req, res) => {
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

  const orgIds = memberships.map((membership) => membership.organizationId);
  const otherMembers = orgIds.length
    ? await prisma.organizationMember.findMany({
        where: {
          organizationId: { in: orgIds },
          userId: { not: userId }
        },
        select: {
          organizationId: true,
          userId: true,
          role: true
        }
      })
    : [];

  const transferTargetByOrg = new Map<string, { userId: string; role: "OWNER" | "MEMBER" }>();
  const blockingOrganizations: string[] = [];

  for (const membership of memberships) {
    const candidates = otherMembers.filter(
      (entry) => entry.organizationId === membership.organizationId
    );
    const transferTarget = chooseTransferTarget(candidates);

    if (!transferTarget) {
      blockingOrganizations.push(membership.organization.name);
      continue;
    }

    transferTargetByOrg.set(membership.organizationId, transferTarget);
  }

  if (blockingOrganizations.length > 0) {
    return res.status(409).json({
      error:
        "Leave or reassign organizations that do not have another member before deleting this account.",
      blockers: {
        organizations: blockingOrganizations
      }
    });
  }

  if (!isUserProActive(user)) {
    const now = new Date();
    const freeUsage = await getEffectiveAiUsage({
      userId,
      email: user.email,
      now
    });

    if (freeUsage > 0) {
      await ensureFreeEmailUsageFloor({
        email: user.email,
        amount: Math.min(freeUsage, FREE_MONTHLY_AI_LIMIT),
        now
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const membership of memberships) {
      const transferTarget = transferTargetByOrg.get(membership.organizationId);
      if (!transferTarget) {
        continue;
      }

      if (membership.role === "OWNER" && transferTarget.role !== "OWNER") {
        await tx.organizationMember.update({
          where: {
            organizationId_userId: {
              organizationId: membership.organizationId,
              userId: transferTarget.userId
            }
          },
          data: {
            role: "OWNER"
          }
        });
      }

      await tx.project.updateMany({
        where: {
          userId,
          orgId: membership.organizationId
        },
        data: {
          userId: transferTarget.userId
        }
      });
    }

    const personalProjects = await tx.project.findMany({
      where: {
        userId,
        orgId: null
      },
      select: {
        id: true
      }
    });

    const personalProjectIds = personalProjects.map((project) => project.id);

    if (personalProjectIds.length > 0) {
      const personalErrors = await tx.error.findMany({
        where: {
          projectId: {
            in: personalProjectIds
          }
        },
        select: {
          id: true
        }
      });

      const personalErrorIds = personalErrors.map((error) => error.id);

      await tx.alertDelivery.deleteMany({
        where: {
          OR: [
            {
              projectId: {
                in: personalProjectIds
              }
            },
            personalErrorIds.length > 0
              ? {
                  errorId: {
                    in: personalErrorIds
                  }
                }
              : undefined
          ].filter(Boolean) as Array<Record<string, unknown>>
        }
      });

      if (personalErrorIds.length > 0) {
        await tx.errorAnalysis.deleteMany({
          where: {
            errorId: {
              in: personalErrorIds
            }
          }
        });

        await tx.errorEvent.deleteMany({
          where: {
            errorId: {
              in: personalErrorIds
            }
          }
        });

        await tx.error.deleteMany({
          where: {
            id: {
              in: personalErrorIds
            }
          }
        });
      }

      await tx.release.deleteMany({
        where: {
          projectId: {
            in: personalProjectIds
          }
        }
      });

      await tx.alertRule.deleteMany({
        where: {
          projectId: {
            in: personalProjectIds
          }
        }
      });

      await tx.project.deleteMany({
        where: {
          id: {
            in: personalProjectIds
          }
        }
      });
    }

    await tx.passwordResetToken.deleteMany({
      where: { userId }
    });
    await tx.emailVerificationCode.deleteMany({
      where: { userId }
    });
    await tx.organizationInvite.deleteMany({
      where: { createdById: userId }
    });
    await tx.orgJoinRequest.deleteMany({
      where: { requesterId: userId }
    });
    await tx.orgJoinRequest.updateMany({
      where: { resolvedById: userId },
      data: { resolvedById: null }
    });
    await tx.orgAuditLog.updateMany({
      where: { actorId: userId },
      data: { actorId: null }
    });
    await tx.alertRule.deleteMany({
      where: { userId }
    });
    await tx.payment.deleteMany({
      where: { userId }
    });
    await tx.organizationMember.deleteMany({
      where: { userId }
    });
    await tx.user.delete({
      where: { id: userId }
    });
  });

  return res.json({ status: "deleted" });
});
