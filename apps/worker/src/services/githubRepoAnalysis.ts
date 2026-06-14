import { decryptIntegrationSecret } from "../utils/integrationSecrets.js";

type GroqMessage = {
  role: "system" | "user";
  content: string;
};

type GroqResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

type GithubRepoSummary = {
  defaultBranch: string;
  description: string | null;
};

type GithubRepoTreeEntry = {
  path: string;
  type: "blob" | "tree";
  size?: number;
};

type GithubRepoFile = {
  path: string;
  content: string;
};

export type SystemDesignComponent = {
  name: string;
  type: string;
  description: string;
  dependsOn: string[];
};

export type GithubRepoAnalysisReport = {
  summary: string;
  architecture: string;
  runtimeFlow: string;
  developmentFlow: string;
  techStack: string[];
  keyModules: string[];
  entryPoints: string[];
  risks: string[];
  onboardingTips: string[];
  systemDesign: SystemDesignComponent[];
};

const groqApiKey = process.env.GROQ_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

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

const fetchGithubRepoSummary = async (
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

const fetchGithubRepoTree = async ({
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

const fetchGithubRepoFile = async ({
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

const normalizeSystemDesign = (value: unknown): SystemDesignComponent[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    name: typeof item?.name === "string" ? item.name : "Unknown Component",
    type: typeof item?.type === "string" ? item.type : "unknown",
    description: typeof item?.description === "string" ? item.description : "",
    dependsOn: Array.isArray(item?.dependsOn) ? item.dependsOn.filter((d: any) => typeof d === "string") : []
  }));
};

const normalizeStringList = (value: unknown, fallback: string[]) => {
  const list = Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  return list.length ? list : fallback;
};

const normalizeReport = (
  value: Partial<GithubRepoAnalysisReport> | null | undefined
): GithubRepoAnalysisReport => ({
  summary: value?.summary?.trim() || "The repository structure needs a closer manual review.",
  architecture:
    value?.architecture?.trim() ||
    "The repository appears to be organized into multiple modules, but the architecture could not be fully inferred.",
  runtimeFlow:
    value?.runtimeFlow?.trim() ||
    "Runtime flow could not be inferred confidently from the available files.",
  developmentFlow:
    value?.developmentFlow?.trim() ||
    "Development workflow details were limited in the available repository context.",
  techStack: normalizeStringList(value?.techStack, ["Tech stack could not be identified confidently."]),
  keyModules: normalizeStringList(value?.keyModules, ["Key modules need manual review."]),
  entryPoints: normalizeStringList(value?.entryPoints, ["Entry points were not confidently identified."]),
  risks: normalizeStringList(value?.risks, ["No major risks were inferred from the sampled repository files."]),
  onboardingTips: normalizeStringList(value?.onboardingTips, [
    "Start with the README and top-level config files.",
    "Review the main app entry points before digging into implementation details."
  ]),
  systemDesign: normalizeSystemDesign(value?.systemDesign)
});

const tryParseReport = (content: string) => {
  try {
    const parsed = JSON.parse(content) as Partial<GithubRepoAnalysisReport>;
    return normalizeReport(parsed);
  } catch {
    return null;
  }
};

const generateGithubRepoAnalysis = async ({
  repoName,
  context,
  analysisType,
  aiModel
}: {
  repoName: string;
  context: string;
  analysisType: string;
  aiModel: string;
}) => {
  const isGemini = aiModel.startsWith("gemini/");

  if (isGemini && !geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  } else if (!isGemini && !groqApiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const systemPromptBase = "You analyze GitHub repositories for developers. Return only valid JSON with this exact shape: ";
  let systemPrompt = "";

  if (analysisType === "system-design") {
    systemPrompt = systemPromptBase + '{"systemDesign":[{"name":"...","type":"...","description":"...","dependsOn":["..."]}]}. The systemDesign field must represent the high-level architecture components (e.g. Load Balancer, Web Server, React App, PostgreSQL, Redis) and their dependencies. Use "type" values like "frontend", "backend", "database", "cache", "queue", "load_balancer", or "other". Keep every field concise, accurate, and grounded in the provided repo data. Do not invent tools or architecture patterns that are not supported by the input.';
  } else {
    systemPrompt = systemPromptBase + '{"summary":"...","architecture":"...","runtimeFlow":"...","developmentFlow":"...","techStack":["..."],"keyModules":["..."],"entryPoints":["..."],"risks":["..."],"onboardingTips":["..."]}. Keep every field concise, accurate, and grounded in the provided repo data. Do not invent tools or architecture patterns that are not supported by the input.';
  }

  const messages: GroqMessage[] = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: `Analyze this GitHub repository and produce a structured engineering report.\n\nRepository: ${repoName}\n\nRepository context:\n${context}`
    }
  ];

  let response: Response;

  if (isGemini) {
    const modelName = aiModel.replace("gemini/", "");
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: messages[1].content }] }],
        systemInstruction: { parts: [{ text: messages[0].content }] },
        generationConfig: { responseMimeType: "application/json", temperature: 0.15 }
      })
    });
  } else {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: aiModel,
        messages,
        temperature: 0.15,
        response_format: {
          type: "json_object"
        }
      })
    });
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${isGemini ? "Gemini" : "Groq"} API error: ${response.status} ${errorBody}`);
  }

  let content: string | undefined;

  if (isGemini) {
    const data = await response.json();
    content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  } else {
    const data = (await response.json()) as GroqResponse;
    content = data.choices?.[0]?.message?.content?.trim();
  }

  if (!content) {
    throw new Error(`${isGemini ? "Gemini" : "Groq"} response missing content`);
  }

  const report = tryParseReport(content);
  if (!report) {
    throw new Error("Groq response was not valid structured JSON");
  }

  return report;
};

const buildRepoAnalysisContext = async ({
  accessToken,
  repoFullName
}: {
  accessToken: string;
  repoFullName: string;
}) => {
  const summary = await fetchGithubRepoSummary(accessToken, repoFullName);
  const tree = await fetchGithubRepoTree({
    accessToken,
    repoFullName,
    branch: summary.defaultBranch
  });

  const rootEntries = tree
    .filter((entry) => !entry.path.includes("/"))
    .map((entry) => `${entry.type === "tree" ? "dir" : "file"}: ${entry.path}`)
    .slice(0, 80);

  const interestingFilePatterns = [
    "README.md",
    "readme.md",
    "package.json",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "turbo.json",
    "nx.json",
    "tsconfig.json",
    "vite.config.ts",
    "vite.config.js",
    "next.config.js",
    "next.config.mjs",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "requirements.txt",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "composer.json",
    "Gemfile"
  ];

  const selectedFiles = Array.from(
    new Set(
      interestingFilePatterns.flatMap((pattern) =>
        tree
          .filter((entry) => entry.type === "blob" && entry.path.toLowerCase() === pattern.toLowerCase())
          .map((entry) => entry.path)
      )
    )
  ).slice(0, 12);

  const fetchedFiles = await Promise.all(
    selectedFiles.map(async (path) => {
      const file = await fetchGithubRepoFile({
        accessToken,
        repoFullName,
        branch: summary.defaultBranch,
        path
      });

      if (!file) return null;
      return {
        path: file.path,
        content: file.content.slice(0, 12000)
      };
    })
  );

  const fileSections = fetchedFiles
    .filter((file): file is { path: string; content: string } => Boolean(file?.content))
    .map((file) => `### ${file.path}\n${file.content}`);

  return {
    tree,
    context: [
      `Default branch: ${summary.defaultBranch}`,
      summary.description ? `Description: ${summary.description}` : "",
      `Top-level structure:\n${rootEntries.join("\n")}`,
      fileSections.length ? `Sampled files:\n\n${fileSections.join("\n\n")}` : ""
    ]
      .filter(Boolean)
      .join("\n\n")
  };
};

export const runGithubRepoAnalysis = async ({
  accessTokenEncrypted,
  repoFullName,
  analysisType,
  aiModel
}: {
  accessTokenEncrypted: string;
  repoFullName: string;
  analysisType: string;
  aiModel: string;
}) => {
  const accessToken = decryptIntegrationSecret(accessTokenEncrypted);
  
  if (analysisType === "graph") {
    const summary = await fetchGithubRepoSummary(accessToken, repoFullName);
    const tree = await fetchGithubRepoTree({
      accessToken,
      repoFullName,
      branch: summary.defaultBranch
    });
    return { report: null, tree };
  }

  const repoContext = await buildRepoAnalysisContext({
    accessToken,
    repoFullName
  });

  const report = await generateGithubRepoAnalysis({
    repoName: repoFullName,
    context: repoContext.context,
    analysisType,
    aiModel
  });

  return { report, tree: repoContext.tree };
};


