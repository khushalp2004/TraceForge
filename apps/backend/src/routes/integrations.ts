import { Router } from "express";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "../utils/integrationSecrets.js";
import {
  parseGithubMetadata,
  parseJiraMetadata,
  parseSlackMetadata,
  resolveJiraAccessToken
} from "../utils/integrationConnectionState.js";
import {
  createJiraIssue,
  exchangeJiraCode,
  exchangeSlackCode,
  fetchGithubRepos,
  fetchJiraIssueTypes,
  fetchJiraProjects,
  fetchJiraResources,
  fetchSlackChannels,
  sendSlackTestMessage
} from "../utils/integrationProviders.js";

export const integrationsRouter = Router();

const frontendUrl = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "http://localhost:3000";
const jwtSecret = process.env.JWT_SECRET || "";
const githubClientId = process.env.GITHUB_CLIENT_ID || "";
const githubRedirectUri = process.env.GITHUB_REDIRECT_URI || "";
const slackClientId = process.env.SLACK_CLIENT_ID || "";
const slackClientSecret = process.env.SLACK_CLIENT_SECRET || "";
const slackRedirectUri = process.env.SLACK_REDIRECT_URI || "";
const jiraClientId = process.env.JIRA_CLIENT_ID || "";
const jiraClientSecret = process.env.JIRA_CLIENT_SECRET || "";
const jiraRedirectUri = process.env.JIRA_REDIRECT_URI || "";

type IntegrationProviderName = "github" | "slack" | "jira";

type IntegrationOauthState = {
  purpose: "integration_oauth";
  provider: IntegrationProviderName;
  userId: string;
  orgId?: string;
  returnTo: string;
};

const buildFrontendRedirect = (params: Record<string, string | undefined>) => {
  const url = new URL("/dashboard/settings", frontendUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
};

const createIntegrationState = (payload: Omit<IntegrationOauthState, "purpose" | "returnTo">) =>
  jwt.sign(
    {
      purpose: "integration_oauth",
      returnTo: "/dashboard/settings",
      ...payload
    } satisfies IntegrationOauthState,
    jwtSecret,
    { expiresIn: "10m" }
  );

const parseIntegrationState = (raw: string) => {
  const payload = jwt.verify(raw, jwtSecret) as IntegrationOauthState;
  if (payload.purpose !== "integration_oauth") {
    throw new Error("Invalid integration state");
  }
  return payload;
};

const isGithubConfigured = () => Boolean(jwtSecret && githubClientId && githubRedirectUri);
const isSlackConfigured = () =>
  Boolean(jwtSecret && slackClientId && slackClientSecret && slackRedirectUri);
const isJiraConfigured = () => Boolean(jwtSecret && jiraClientId && jiraClientSecret && jiraRedirectUri);

const getOrgMembership = async (orgId: string, userId: string) =>
  prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId
      }
    }
  });

const requireOrganizationAccess = async (orgId: string, userId: string) => {
  const membership = await getOrgMembership(orgId, userId);
  if (!membership) {
    return null;
  }
  return membership;
};

const toJson = (value: Record<string, unknown>) => value as Prisma.InputJsonValue;

const pickJiraIssueType = async ({
  accessToken,
  cloudId,
  projectId,
  projectKey
}: {
  accessToken: string;
  cloudId: string;
  projectId: string;
  projectKey?: string;
}) => {
  const preferredNameOrder = ["Task", "Bug", "Story"];

  const choosePreferred = (issueTypes: Array<{ id: string; name: string }>) =>
    preferredNameOrder
      .map((name) => issueTypes.find((issueType) => issueType.name === name))
      .find(Boolean) || issueTypes[0] || null;

  const issueTypes = await fetchJiraIssueTypes(accessToken, cloudId, projectId);
  const preferred = choosePreferred(issueTypes);
  if (preferred) {
    return preferred;
  }

  if (projectKey) {
    const fallbackTypes = await fetchJiraIssueTypes(accessToken, cloudId, projectKey);
    return choosePreferred(fallbackTypes);
  }

  return null;
};

integrationsRouter.get("/slack/callback", async (req, res) => {
  if (!isSlackConfigured()) {
    return res.redirect(
      buildFrontendRedirect({
        integration: "slack",
        integrationStatus: "error",
        integrationMessage: "Slack integration is not configured"
      })
    );
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";

  if (!code || !state) {
    return res.redirect(
      buildFrontendRedirect({
        integration: "slack",
        integrationStatus: "error",
        integrationMessage: "Slack callback was invalid"
      })
    );
  }

  try {
    const parsedState = parseIntegrationState(state);
    if (parsedState.provider !== "slack" || !parsedState.orgId) {
      throw new Error("Slack callback state was invalid");
    }

    const membership = await getOrgMembership(parsedState.orgId, parsedState.userId);
    if (!membership || membership.role !== "OWNER") {
      throw new Error("Only organization owners can connect Slack");
    }

    const connection = await exchangeSlackCode({
      clientId: slackClientId,
      clientSecret: slackClientSecret,
      code,
      redirectUri: slackRedirectUri
    });

    const existing = await prisma.integrationConnection.findUnique({
      where: {
        provider_organizationId: {
          provider: "SLACK",
          organizationId: parsedState.orgId
        }
      }
    });

    await prisma.integrationConnection.upsert({
      where: {
        provider_organizationId: {
          provider: "SLACK",
          organizationId: parsedState.orgId
        }
      },
      update: {
        scope: "ORGANIZATION",
        status: "CONNECTED",
        externalAccountId: connection.teamId,
        externalAccountName: connection.teamName,
        accessTokenEncrypted: encryptIntegrationSecret(connection.accessToken),
        metadata: toJson({
          ...parseSlackMetadata(existing?.metadata),
          selectedChannelId: parseSlackMetadata(existing?.metadata).selectedChannelId,
          selectedChannelName: parseSlackMetadata(existing?.metadata).selectedChannelName
        }),
        lastSyncedAt: new Date()
      },
      create: {
        provider: "SLACK",
        scope: "ORGANIZATION",
        organizationId: parsedState.orgId,
        status: "CONNECTED",
        externalAccountId: connection.teamId,
        externalAccountName: connection.teamName,
        accessTokenEncrypted: encryptIntegrationSecret(connection.accessToken),
        metadata: toJson({}),
        lastSyncedAt: new Date()
      }
    });

    return res.redirect(
      buildFrontendRedirect({
        integration: "slack",
        integrationStatus: "connected",
        orgId: parsedState.orgId
      })
    );
  } catch (error) {
    return res.redirect(
      buildFrontendRedirect({
        integration: "slack",
        integrationStatus: "error",
        integrationMessage: error instanceof Error ? error.message : "Slack connection failed"
      })
    );
  }
});

integrationsRouter.get("/jira/callback", async (req, res) => {
  if (!isJiraConfigured()) {
    return res.redirect(
      buildFrontendRedirect({
        integration: "jira",
        integrationStatus: "error",
        integrationMessage: "Jira integration is not configured"
      })
    );
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";

  if (!code || !state) {
    return res.redirect(
      buildFrontendRedirect({
        integration: "jira",
        integrationStatus: "error",
        integrationMessage: "Jira callback was invalid"
      })
    );
  }

  try {
    const parsedState = parseIntegrationState(state);
    if (parsedState.provider !== "jira" || !parsedState.orgId) {
      throw new Error("Jira callback state was invalid");
    }

    const membership = await getOrgMembership(parsedState.orgId, parsedState.userId);
    if (!membership || membership.role !== "OWNER") {
      throw new Error("Only organization owners can connect Jira");
    }

    const tokenSet = await exchangeJiraCode({
      clientId: jiraClientId,
      clientSecret: jiraClientSecret,
      code,
      redirectUri: jiraRedirectUri
    });
    const sites = await fetchJiraResources(tokenSet.accessToken);
    const primarySite = sites[0] || null;

    await prisma.integrationConnection.upsert({
      where: {
        provider_organizationId: {
          provider: "JIRA",
          organizationId: parsedState.orgId
        }
      },
      update: {
        scope: "ORGANIZATION",
        status: "CONNECTED",
        externalAccountId: primarySite?.id || null,
        externalAccountName: primarySite?.name || "Atlassian workspace",
        accessTokenEncrypted: encryptIntegrationSecret(tokenSet.accessToken),
        refreshTokenEncrypted: tokenSet.refreshToken
          ? encryptIntegrationSecret(tokenSet.refreshToken)
          : undefined,
        tokenExpiresAt: tokenSet.expiresIn
          ? new Date(Date.now() + tokenSet.expiresIn * 1000)
          : undefined,
        metadata: toJson({
          selectedSiteId: primarySite?.id,
          selectedSiteName: primarySite?.name
        }),
        lastSyncedAt: new Date()
      },
      create: {
        provider: "JIRA",
        scope: "ORGANIZATION",
        organizationId: parsedState.orgId,
        status: "CONNECTED",
        externalAccountId: primarySite?.id || null,
        externalAccountName: primarySite?.name || "Atlassian workspace",
        accessTokenEncrypted: encryptIntegrationSecret(tokenSet.accessToken),
        refreshTokenEncrypted: tokenSet.refreshToken
          ? encryptIntegrationSecret(tokenSet.refreshToken)
          : undefined,
        tokenExpiresAt: tokenSet.expiresIn
          ? new Date(Date.now() + tokenSet.expiresIn * 1000)
          : undefined,
        metadata: toJson({
          selectedSiteId: primarySite?.id,
          selectedSiteName: primarySite?.name
        }),
        lastSyncedAt: new Date()
      }
    });

    return res.redirect(
      buildFrontendRedirect({
        integration: "jira",
        integrationStatus: "connected",
        orgId: parsedState.orgId
      })
    );
  } catch (error) {
    return res.redirect(
      buildFrontendRedirect({
        integration: "jira",
        integrationStatus: "error",
        integrationMessage: error instanceof Error ? error.message : "Jira connection failed"
      })
    );
  }
});

integrationsRouter.use(requireAuth);

integrationsRouter.get("/github", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_userId: {
        provider: "GITHUB",
        userId
      }
    }
  });

  if (!connection) {
    return res.json({
      configured: isGithubConfigured(),
      connected: false
    });
  }

  const metadata = parseGithubMetadata(connection.metadata);

  try {
    const repos = await fetchGithubRepos(decryptIntegrationSecret(connection.accessTokenEncrypted));
    return res.json({
      configured: isGithubConfigured(),
      connected: true,
      account: {
        id: connection.externalAccountId,
        name: connection.externalAccountName,
        login: metadata.login || null
      },
      repos,
      selectedRepoIds: metadata.selectedRepoIds || []
    });
  } catch (error) {
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { status: "ERROR" }
    });

    return res.json({
      configured: isGithubConfigured(),
      connected: true,
      status: "error",
      account: {
        id: connection.externalAccountId,
        name: connection.externalAccountName,
        login: metadata.login || null
      },
      repos: [],
      selectedRepoIds: metadata.selectedRepoIds || [],
      error: error instanceof Error ? error.message : "Failed to load GitHub repositories"
    });
  }
});

integrationsRouter.post("/github/start", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isGithubConfigured()) {
    return res.status(503).json({ error: "GitHub integration is not configured" });
  }

  const state = createIntegrationState({
    provider: "github",
    userId
  });

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", githubClientId);
  url.searchParams.set("redirect_uri", githubRedirectUri);
  url.searchParams.set("scope", "read:user user:email repo read:org");
  url.searchParams.set("state", state);

  return res.json({ url: url.toString() });
});

integrationsRouter.patch("/github/repos", async (req, res) => {
  const userId = req.user?.id;
  const { selectedRepoIds } = req.body as { selectedRepoIds?: string[] };
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!Array.isArray(selectedRepoIds)) {
    return res.status(400).json({ error: "selectedRepoIds must be an array" });
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_userId: {
        provider: "GITHUB",
        userId
      }
    }
  });

  if (!connection) {
    return res.status(404).json({ error: "GitHub account not connected" });
  }

  const metadata = parseGithubMetadata(connection.metadata);
  const updated = await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      metadata: toJson({
        ...metadata,
        selectedRepoIds
      }),
      status: "CONNECTED"
    }
  });

  return res.json({
    selectedRepoIds: parseGithubMetadata(updated.metadata).selectedRepoIds || []
  });
});

integrationsRouter.delete("/github", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await prisma.integrationConnection.deleteMany({
    where: {
      provider: "GITHUB",
      userId
    }
  });

  return res.json({ ok: true });
});

integrationsRouter.get("/slack", async (req, res) => {
  const userId = req.user?.id;
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!orgId) {
    return res.status(400).json({ error: "orgId is required" });
  }

  const membership = await requireOrganizationAccess(orgId, userId);
  if (!membership) {
    return res.status(403).json({ error: "Organization access denied" });
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_organizationId: {
        provider: "SLACK",
        organizationId: orgId
      }
    }
  });

  if (!connection) {
    return res.json({
      configured: isSlackConfigured(),
      connected: false,
      canManage: membership.role === "OWNER"
    });
  }

  const metadata = parseSlackMetadata(connection.metadata);

  try {
    const channels = await fetchSlackChannels(decryptIntegrationSecret(connection.accessTokenEncrypted));
    return res.json({
      configured: isSlackConfigured(),
      connected: true,
      canManage: membership.role === "OWNER",
      workspace: {
        id: connection.externalAccountId,
        name: connection.externalAccountName
      },
      channels,
      selectedChannelId: metadata.selectedChannelId || "",
      selectedChannelName: metadata.selectedChannelName || ""
    });
  } catch (error) {
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { status: "ERROR" }
    });

    return res.json({
      configured: isSlackConfigured(),
      connected: true,
      canManage: membership.role === "OWNER",
      workspace: {
        id: connection.externalAccountId,
        name: connection.externalAccountName
      },
      channels: [],
      selectedChannelId: metadata.selectedChannelId || "",
      selectedChannelName: metadata.selectedChannelName || "",
      error: error instanceof Error ? error.message : "Failed to load Slack channels"
    });
  }
});

integrationsRouter.post("/slack/start", async (req, res) => {
  const userId = req.user?.id;
  const { orgId } = req.body as { orgId?: string };
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!orgId) {
    return res.status(400).json({ error: "orgId is required" });
  }
  if (!isSlackConfigured()) {
    return res.status(503).json({ error: "Slack integration is not configured" });
  }

  const membership = await requireOrganizationAccess(orgId, userId);
  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only organization owners can connect Slack" });
  }

  const state = createIntegrationState({
    provider: "slack",
    userId,
    orgId
  });

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", slackClientId);
  url.searchParams.set("redirect_uri", slackRedirectUri);
  url.searchParams.set("scope", "channels:read,groups:read,chat:write");
  url.searchParams.set("state", state);

  return res.json({ url: url.toString() });
});

integrationsRouter.patch("/slack/channel", async (req, res) => {
  const userId = req.user?.id;
  const { orgId, channelId } = req.body as { orgId?: string; channelId?: string };
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!orgId || !channelId) {
    return res.status(400).json({ error: "orgId and channelId are required" });
  }

  const membership = await requireOrganizationAccess(orgId, userId);
  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only organization owners can update Slack" });
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_organizationId: {
        provider: "SLACK",
        organizationId: orgId
      }
    }
  });

  if (!connection) {
    return res.status(404).json({ error: "Slack is not connected" });
  }

  const channels = await fetchSlackChannels(decryptIntegrationSecret(connection.accessTokenEncrypted));
  const selectedChannel = channels.find((channel) => channel.id === channelId);
  if (!selectedChannel) {
    return res.status(404).json({ error: "Channel not found in connected Slack workspace" });
  }

  const updated = await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      metadata: toJson({
        ...parseSlackMetadata(connection.metadata),
        selectedChannelId: selectedChannel.id,
        selectedChannelName: selectedChannel.name
      }),
      status: "CONNECTED"
    }
  });

  return res.json({
    selectedChannelId: parseSlackMetadata(updated.metadata).selectedChannelId || "",
    selectedChannelName: parseSlackMetadata(updated.metadata).selectedChannelName || ""
  });
});

integrationsRouter.post("/slack/test", async (req, res) => {
  const userId = req.user?.id;
  const { orgId } = req.body as { orgId?: string };
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!orgId) {
    return res.status(400).json({ error: "orgId is required" });
  }

  const membership = await requireOrganizationAccess(orgId, userId);
  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only organization owners can send a Slack test" });
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_organizationId: {
        provider: "SLACK",
        organizationId: orgId
      }
    }
  });

  if (!connection) {
    return res.status(404).json({ error: "Slack is not connected" });
  }

  const metadata = parseSlackMetadata(connection.metadata);
  if (!metadata.selectedChannelId) {
    return res.status(400).json({ error: "Choose a default Slack channel first" });
  }

  try {
    await sendSlackTestMessage(
      decryptIntegrationSecret(connection.accessTokenEncrypted),
      metadata.selectedChannelId,
      `TraceForge test message • ${new Date().toLocaleString("en-IN")}`
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to send Slack test message"
    });
  }
});

integrationsRouter.delete("/slack", async (req, res) => {
  const userId = req.user?.id;
  const { orgId } = req.body as { orgId?: string };
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!orgId) {
    return res.status(400).json({ error: "orgId is required" });
  }

  const membership = await requireOrganizationAccess(orgId, userId);
  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only organization owners can disconnect Slack" });
  }

  await prisma.integrationConnection.deleteMany({
    where: {
      provider: "SLACK",
      organizationId: orgId
    }
  });

  return res.json({ ok: true });
});

integrationsRouter.get("/jira", async (req, res) => {
  const userId = req.user?.id;
  const orgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
  const siteIdOverride = typeof req.query.siteId === "string" ? req.query.siteId : "";
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!orgId) {
    return res.status(400).json({ error: "orgId is required" });
  }

  const membership = await requireOrganizationAccess(orgId, userId);
  if (!membership) {
    return res.status(403).json({ error: "Organization access denied" });
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_organizationId: {
        provider: "JIRA",
        organizationId: orgId
      }
    }
  });

  if (!connection) {
    return res.json({
      configured: isJiraConfigured(),
      connected: false,
      canManage: membership.role === "OWNER"
    });
  }

  const metadata = parseJiraMetadata(connection.metadata);

  try {
    const { accessToken } = await resolveJiraAccessToken(
      connection,
      jiraClientId,
      jiraClientSecret
    );
    const sites = await fetchJiraResources(accessToken);
    const selectedSiteId = siteIdOverride || metadata.selectedSiteId || sites[0]?.id || "";
    const projects = selectedSiteId ? await fetchJiraProjects(accessToken, selectedSiteId) : [];

    return res.json({
      configured: isJiraConfigured(),
      connected: true,
      canManage: membership.role === "OWNER",
      site: {
        id: selectedSiteId,
        name: metadata.selectedSiteName || sites.find((site) => site.id === selectedSiteId)?.name || ""
      },
      sites,
      projects,
      selectedSiteId,
      selectedProjectId: metadata.selectedProjectId || "",
      selectedProjectKey: metadata.selectedProjectKey || "",
      selectedProjectName: metadata.selectedProjectName || ""
    });
  } catch (error) {
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { status: "ERROR" }
    });

    return res.json({
      configured: isJiraConfigured(),
      connected: true,
      canManage: membership.role === "OWNER",
      sites: [],
      projects: [],
      selectedSiteId: metadata.selectedSiteId || "",
      selectedProjectId: metadata.selectedProjectId || "",
      selectedProjectKey: metadata.selectedProjectKey || "",
      selectedProjectName: metadata.selectedProjectName || "",
      error: error instanceof Error ? error.message : "Failed to load Jira projects"
    });
  }
});

integrationsRouter.post("/jira/start", async (req, res) => {
  const userId = req.user?.id;
  const { orgId } = req.body as { orgId?: string };
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!orgId) {
    return res.status(400).json({ error: "orgId is required" });
  }
  if (!isJiraConfigured()) {
    return res.status(503).json({ error: "Jira integration is not configured" });
  }

  const membership = await requireOrganizationAccess(orgId, userId);
  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only organization owners can connect Jira" });
  }

  const state = createIntegrationState({
    provider: "jira",
    userId,
    orgId
  });

  const url = new URL("https://auth.atlassian.com/authorize");
  url.searchParams.set("audience", "api.atlassian.com");
  url.searchParams.set("client_id", jiraClientId);
  url.searchParams.set("scope", "offline_access read:jira-user read:jira-work write:jira-work");
  url.searchParams.set("redirect_uri", jiraRedirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("prompt", "consent");

  return res.json({ url: url.toString() });
});

integrationsRouter.patch("/jira/config", async (req, res) => {
  const userId = req.user?.id;
  const { orgId, siteId, projectId } = req.body as {
    orgId?: string;
    siteId?: string;
    projectId?: string;
  };
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!orgId || !siteId || !projectId) {
    return res.status(400).json({ error: "orgId, siteId, and projectId are required" });
  }

  const membership = await requireOrganizationAccess(orgId, userId);
  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only organization owners can update Jira" });
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_organizationId: {
        provider: "JIRA",
        organizationId: orgId
      }
    }
  });

  if (!connection) {
    return res.status(404).json({ error: "Jira is not connected" });
  }

  const { accessToken } = await resolveJiraAccessToken(
    connection,
    jiraClientId,
    jiraClientSecret
  );
  const sites = await fetchJiraResources(accessToken);
  const selectedSite = sites.find((site) => site.id === siteId);
  if (!selectedSite) {
    return res.status(404).json({ error: "Jira site not found" });
  }

  const projects = await fetchJiraProjects(accessToken, selectedSite.id);
  const selectedProject = projects.find((project) => project.id === projectId);
  if (!selectedProject) {
    return res.status(404).json({ error: "Jira project not found" });
  }

  const updated = await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      metadata: toJson({
        ...parseJiraMetadata(connection.metadata),
        selectedSiteId: selectedSite.id,
        selectedSiteName: selectedSite.name,
        selectedProjectId: selectedProject.id,
        selectedProjectKey: selectedProject.key,
        selectedProjectName: selectedProject.name
      }),
      status: "CONNECTED",
      lastSyncedAt: new Date()
    }
  });

  return res.json(parseJiraMetadata(updated.metadata));
});

integrationsRouter.post("/jira/test", async (req, res) => {
  const userId = req.user?.id;
  const { orgId } = req.body as { orgId?: string };
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!orgId) {
    return res.status(400).json({ error: "orgId is required" });
  }

  const membership = await requireOrganizationAccess(orgId, userId);
  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only organization owners can send a Jira test" });
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: {
      provider_organizationId: {
        provider: "JIRA",
        organizationId: orgId
      }
    }
  });

  if (!connection) {
    return res.status(404).json({ error: "Jira is not connected" });
  }

  const metadata = parseJiraMetadata(connection.metadata);
  if (!metadata.selectedSiteId || !metadata.selectedProjectId) {
    return res.status(400).json({ error: "Choose a default Jira project first" });
  }

  try {
    const { accessToken } = await resolveJiraAccessToken(
      connection,
      jiraClientId,
      jiraClientSecret
    );
    const issueType = await pickJiraIssueType({
      accessToken,
      cloudId: metadata.selectedSiteId,
      projectId: metadata.selectedProjectId,
      projectKey: metadata.selectedProjectKey
    });

    if (!issueType) {
      return res.status(400).json({
        error: "No supported Jira issue type was found for the selected project"
      });
    }

    const issue = await createJiraIssue({
      accessToken,
      cloudId: metadata.selectedSiteId,
      projectId: metadata.selectedProjectId,
      issueTypeId: issueType.id,
      summary: "TraceForge integration test",
      description:
        "This is a Jira integration test issue created from TraceForge Settings. If you can see this issue, the Jira connection is working."
    });

    return res.json({ ok: true, issue });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to create Jira test issue"
    });
  }
});

integrationsRouter.delete("/jira", async (req, res) => {
  const userId = req.user?.id;
  const { orgId } = req.body as { orgId?: string };
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!orgId) {
    return res.status(400).json({ error: "orgId is required" });
  }

  const membership = await requireOrganizationAccess(orgId, userId);
  if (!membership || membership.role !== "OWNER") {
    return res.status(403).json({ error: "Only organization owners can disconnect Jira" });
  }

  await prisma.integrationConnection.deleteMany({
    where: {
      provider: "JIRA",
      organizationId: orgId
    }
  });

  return res.json({ ok: true });
});
