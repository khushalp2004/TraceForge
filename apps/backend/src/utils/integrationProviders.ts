type GithubExchangeArgs = {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
};

type SlackExchangeArgs = {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
};

type JiraExchangeArgs = {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
};

type JiraRefreshArgs = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export type GithubProfile = {
  id: string;
  login: string;
  email: string;
  name: string;
};

export type GithubRepo = {
  id: string;
  fullName: string;
  private: boolean;
  url: string;
};

export type GithubRepoSummary = {
  defaultBranch: string;
  description: string | null;
};

export type GithubRepoTreeEntry = {
  path: string;
  type: "blob" | "tree";
  size?: number;
};

export type GithubRepoFile = {
  path: string;
  content: string;
};

export type GithubCreatedIssue = {
  id: string;
  number: number;
  title: string;
  url: string;
};

export type SlackConnectionInfo = {
  accessToken: string;
  teamId: string;
  teamName: string;
};

export type SlackChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
};

export type JiraTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

export type JiraResource = {
  id: string;
  name: string;
  url: string;
};

export type JiraProject = {
  id: string;
  key: string;
  name: string;
};

type JiraIssueType = {
  id: string;
  name: string;
};

export const exchangeGithubCode = async ({
  clientId,
  clientSecret,
  code,
  redirectUri
}: GithubExchangeArgs) => {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
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

export const fetchGithubProfile = async (accessToken: string): Promise<GithubProfile> => {
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
    login?: string;
    name?: string | null;
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
    name: userData.name?.trim() || userData.login
  };
};

export const fetchGithubRepos = async (accessToken: string): Promise<GithubRepo[]> => {
  const response = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    }
  );

  const data = (await response.json().catch(() => [])) as Array<{
    id: number;
    full_name: string;
    private: boolean;
    html_url: string;
  }>;

  if (!response.ok) {
    throw new Error("Failed to fetch GitHub repositories");
  }

  return data.map((repo) => ({
    id: String(repo.id),
    fullName: repo.full_name,
    private: repo.private,
    url: repo.html_url
  }));
};

const githubHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28"
});

const parseRepoFullName = (repoFullName: string) => {
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) {
    throw new Error("Invalid GitHub repository selection");
  }
  return { owner, repo };
};

export const fetchGithubRepoSummary = async (
  accessToken: string,
  repoFullName: string
): Promise<GithubRepoSummary> => {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      headers: githubHeaders(accessToken)
    }
  );

  const data = (await response.json().catch(() => ({}))) as {
    default_branch?: string;
    description?: string | null;
    message?: string;
  };

  if (!response.ok || !data.default_branch) {
    throw new Error(data.message || "Failed to fetch GitHub repository summary");
  }

  return {
    defaultBranch: data.default_branch,
    description: data.description ?? null
  };
};

export const fetchGithubRepoTree = async ({
  accessToken,
  repoFullName,
  branch
}: {
  accessToken: string;
  repoFullName: string;
  branch: string;
}): Promise<GithubRepoTreeEntry[]> => {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    {
      headers: githubHeaders(accessToken)
    }
  );

  const data = (await response.json().catch(() => ({}))) as {
    tree?: Array<{ path?: string; type?: "blob" | "tree"; size?: number }>;
    message?: string;
  };

  if (!response.ok || !Array.isArray(data.tree)) {
    throw new Error(data.message || "Failed to fetch GitHub repository tree");
  }

  return data.tree
    .filter((entry): entry is { path: string; type: "blob" | "tree"; size?: number } =>
      Boolean(entry.path && entry.type && (entry.type === "blob" || entry.type === "tree"))
    )
    .map((entry) => ({
      path: entry.path,
      type: entry.type,
      size: entry.size
    }));
};

export const fetchGithubRepoFile = async ({
  accessToken,
  repoFullName,
  path,
  branch
}: {
  accessToken: string;
  repoFullName: string;
  path: string;
  branch: string;
}): Promise<GithubRepoFile | null> => {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}?ref=${encodeURIComponent(branch)}`,
    {
      headers: githubHeaders(accessToken)
    }
  );

  if (response.status === 404) {
    return null;
  }

  const data = (await response.json().catch(() => ({}))) as {
    content?: string;
    encoding?: string;
    message?: string;
    type?: string;
  };

  if (!response.ok) {
    throw new Error(data.message || `Failed to fetch ${path} from GitHub`);
  }

  if (data.type !== "file" || !data.content || data.encoding !== "base64") {
    return null;
  }

  return {
    path,
    content: Buffer.from(data.content, "base64").toString("utf8")
  };
};

export const createGithubIssue = async ({
  accessToken,
  repoFullName,
  title,
  body
}: {
  accessToken: string;
  repoFullName: string;
  title: string;
  body: string;
}): Promise<GithubCreatedIssue> => {
  const { owner, repo } = parseRepoFullName(repoFullName);

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        title,
        body
      })
    }
  );

  const data = (await response.json().catch(() => ({}))) as {
    id?: number;
    number?: number;
    title?: string;
    html_url?: string;
    message?: string;
    errors?: Array<{ message?: string }>;
  };

  if (!response.ok || !data.id || !data.number || !data.html_url || !data.title) {
    const detail =
      data.errors?.map((entry) => entry.message).filter(Boolean).join(", ") ||
      data.message ||
      "Failed to create GitHub issue";
    throw new Error(detail);
  }

  return {
    id: String(data.id),
    number: data.number,
    title: data.title,
    url: data.html_url
  };
};

export const exchangeSlackCode = async ({
  clientId,
  clientSecret,
  code,
  redirectUri
}: SlackExchangeArgs): Promise<SlackConnectionInfo> => {
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    })
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    access_token?: string;
    team?: { id?: string; name?: string };
    error?: string;
  };

  if (!response.ok || !data.ok || !data.access_token || !data.team?.id || !data.team?.name) {
    throw new Error(data.error || "Failed to exchange Slack code");
  }

  return {
    accessToken: data.access_token,
    teamId: data.team.id,
    teamName: data.team.name
  };
};

export const fetchSlackChannels = async (accessToken: string): Promise<SlackChannel[]> => {
  const response = await fetch(
    "https://slack.com/api/conversations.list?exclude_archived=true&limit=200&types=public_channel,private_channel",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    channels?: Array<{ id?: string; name?: string; is_private?: boolean }>;
    error?: string;
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Failed to fetch Slack channels");
  }

  return (data.channels || [])
    .filter((channel) => channel.id && channel.name)
    .map((channel) => ({
      id: channel.id as string,
      name: channel.name as string,
      isPrivate: Boolean(channel.is_private)
    }));
};

export const sendSlackMessage = async (
  accessToken: string,
  channelId: string,
  text: string
) => {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      channel: channelId,
      text
    })
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };

  if (!response.ok || !data.ok) {
    if (data.error === "not_in_channel") {
      throw new Error(
        "Slack app is not in that channel yet. Invite the app to the channel first, then send the test again."
      );
    }

    if (data.error === "channel_not_found") {
      throw new Error("Slack channel was not found. Re-select the channel and try again.");
    }

    if (data.error === "missing_scope") {
      throw new Error(
        "Slack app is missing required permissions. Check channels:read, groups:read, and chat:write scopes."
      );
    }

    throw new Error(data.error || "Failed to send Slack test message");
  }
};

export const sendSlackTestMessage = async (
  accessToken: string,
  channelId: string,
  text: string
) => sendSlackMessage(accessToken, channelId, text);

export const exchangeJiraCode = async ({
  clientId,
  clientSecret,
  code,
  redirectUri
}: JiraExchangeArgs): Promise<JiraTokenSet> => {
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    })
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to exchange Jira code");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in
  };
};

export const refreshJiraToken = async ({
  clientId,
  clientSecret,
  refreshToken
}: JiraRefreshArgs): Promise<JiraTokenSet> => {
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    })
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to refresh Jira token");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in
  };
};

export const fetchJiraResources = async (accessToken: string): Promise<JiraResource[]> => {
  const response = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  const data = (await response.json().catch(() => [])) as Array<{
    id?: string;
    name?: string;
    url?: string;
  }>;

  if (!response.ok) {
    throw new Error("Failed to fetch Jira sites");
  }

  return data
    .filter((resource) => resource.id && resource.name && resource.url)
    .map((resource) => ({
      id: resource.id as string,
      name: resource.name as string,
      url: resource.url as string
    }));
};

export const fetchJiraProjects = async (
  accessToken: string,
  cloudId: string
): Promise<JiraProject[]> => {
  const response = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search?maxResults=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    }
  );

  const data = (await response.json().catch(() => ({}))) as {
    values?: Array<{ id?: string; key?: string; name?: string }>;
  };

  if (!response.ok) {
    throw new Error("Failed to fetch Jira projects");
  }

  return (data.values || [])
    .filter((project) => project.id && project.key && project.name)
    .map((project) => ({
      id: project.id as string,
      key: project.key as string,
      name: project.name as string
    }));
};

export const fetchJiraIssueTypes = async (
  accessToken: string,
  cloudId: string,
  projectIdOrKey: string
): Promise<JiraIssueType[]> => {
  const response = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/${projectIdOrKey}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    }
  );

  const data = (await response.json().catch(() => ({}))) as {
    issueTypes?: Array<{ id?: string; name?: string; subtask?: boolean }>;
  };

  if (!response.ok) {
    throw new Error("Failed to fetch Jira issue types");
  }

  return (data.issueTypes || [])
    .filter((issueType) => issueType.id && issueType.name && !issueType.subtask)
    .map((issueType) => ({
      id: issueType.id as string,
      name: issueType.name as string
    }));
};

export const createJiraIssue = async ({
  accessToken,
  cloudId,
  projectId,
  summary,
  description,
  issueTypeId
}: {
  accessToken: string;
  cloudId: string;
  projectId: string;
  summary: string;
  description: string;
  issueTypeId: string;
}) => {
  const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        project: { id: projectId },
        summary,
        issuetype: { id: issueTypeId },
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: description
                }
              ]
            }
          ]
        }
      }
    })
  });

  const data = (await response.json().catch(() => ({}))) as {
    key?: string;
    self?: string;
    errorMessages?: string[];
    errors?: Record<string, string>;
  };

  if (!response.ok || !data.key) {
    const fieldErrors = data.errors
      ? Object.entries(data.errors)
          .map(([field, message]) => `${field}: ${message}`)
          .join(", ")
      : "";
    throw new Error(data.errorMessages?.join(", ") || fieldErrors || "Failed to create Jira issue");
  }

  return {
    key: data.key,
    self: data.self || ""
  };
};
