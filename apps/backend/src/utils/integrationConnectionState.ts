import type { IntegrationConnection, Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./integrationSecrets.js";
import { refreshJiraToken } from "./integrationProviders.js";

export type GithubIntegrationMetadata = {
  login?: string;
  selectedRepoIds?: string[];
};

export type SlackIntegrationMetadata = {
  selectedChannelId?: string;
  selectedChannelName?: string;
};

export type JiraIntegrationMetadata = {
  selectedSiteId?: string;
  selectedSiteName?: string;
  selectedProjectId?: string;
  selectedProjectKey?: string;
  selectedProjectName?: string;
};

export const parseGithubMetadata = (
  value: Prisma.JsonValue | null | undefined
): GithubIntegrationMetadata => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, Prisma.JsonValue>;
  return {
    login: typeof record.login === "string" ? record.login : undefined,
    selectedRepoIds: Array.isArray(record.selectedRepoIds)
      ? record.selectedRepoIds.filter((entry): entry is string => typeof entry === "string")
      : []
  };
};

export const parseSlackMetadata = (
  value: Prisma.JsonValue | null | undefined
): SlackIntegrationMetadata => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, Prisma.JsonValue>;
  return {
    selectedChannelId:
      typeof record.selectedChannelId === "string" ? record.selectedChannelId : undefined,
    selectedChannelName:
      typeof record.selectedChannelName === "string" ? record.selectedChannelName : undefined
  };
};

export const parseJiraMetadata = (
  value: Prisma.JsonValue | null | undefined
): JiraIntegrationMetadata => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, Prisma.JsonValue>;
  return {
    selectedSiteId: typeof record.selectedSiteId === "string" ? record.selectedSiteId : undefined,
    selectedSiteName:
      typeof record.selectedSiteName === "string" ? record.selectedSiteName : undefined,
    selectedProjectId:
      typeof record.selectedProjectId === "string" ? record.selectedProjectId : undefined,
    selectedProjectKey:
      typeof record.selectedProjectKey === "string" ? record.selectedProjectKey : undefined,
    selectedProjectName:
      typeof record.selectedProjectName === "string" ? record.selectedProjectName : undefined
  };
};

export const resolveJiraAccessToken = async (
  connection: IntegrationConnection,
  clientId: string,
  clientSecret: string
) => {
  const accessToken = decryptIntegrationSecret(connection.accessTokenEncrypted);

  if (!connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return {
      accessToken,
      connection
    };
  }

  if (!connection.refreshTokenEncrypted) {
    return {
      accessToken,
      connection
    };
  }

  const refreshToken = decryptIntegrationSecret(connection.refreshTokenEncrypted);
  const refreshed = await refreshJiraToken({
    clientId,
    clientSecret,
    refreshToken
  });

  const updatedConnection = await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encryptIntegrationSecret(refreshed.accessToken),
      refreshTokenEncrypted: refreshed.refreshToken
        ? encryptIntegrationSecret(refreshed.refreshToken)
        : connection.refreshTokenEncrypted,
      tokenExpiresAt: refreshed.expiresIn
        ? new Date(Date.now() + refreshed.expiresIn * 1000)
        : connection.tokenExpiresAt,
      lastSyncedAt: new Date(),
      status: "CONNECTED"
    }
  });

  return {
    accessToken: refreshed.accessToken,
    connection: updatedConnection
  };
};
