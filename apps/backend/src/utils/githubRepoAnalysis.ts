const GITHUB_REPO_ANALYSIS_MODEL = "groq/compound-mini";

type GroqMessage = {
  role: "system" | "user";
  content: string;
};

type GroqResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
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
};

const groqApiKey = process.env.GROQ_API_KEY;

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
  ])
});

const tryParseReport = (content: string) => {
  try {
    const parsed = JSON.parse(content) as Partial<GithubRepoAnalysisReport>;
    return normalizeReport(parsed);
  } catch {
    return null;
  }
};

export const GITHUB_REPO_ANALYSIS_COST = 50;
export { GITHUB_REPO_ANALYSIS_MODEL };

export const generateGithubRepoAnalysis = async ({
  repoName,
  context
}: {
  repoName: string;
  context: string;
}) => {
  if (!groqApiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const messages: GroqMessage[] = [
    {
      role: "system",
      content:
        'You analyze GitHub repositories for developers. Return only valid JSON with this exact shape: {"summary":"...","architecture":"...","runtimeFlow":"...","developmentFlow":"...","techStack":["..."],"keyModules":["..."],"entryPoints":["..."],"risks":["..."],"onboardingTips":["..."]}. Keep every field concise, accurate, and grounded in the provided repo data. Do not invent tools or architecture patterns that are not supported by the input.'
    },
    {
      role: "user",
      content: `Analyze this GitHub repository and produce a structured engineering report.\n\nRepository: ${repoName}\n\nRepository context:\n${context}`
    }
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqApiKey}`
    },
    body: JSON.stringify({
      model: GITHUB_REPO_ANALYSIS_MODEL,
      messages,
      temperature: 0.15,
      response_format: {
        type: "json_object"
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as GroqResponse;
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("Groq response missing content");
  }

  const report = tryParseReport(content);
  if (!report) {
    throw new Error("Groq response was not valid structured JSON");
  }

  return report;
};
