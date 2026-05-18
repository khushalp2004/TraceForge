export const supportedAiModels = [
  {
    id: "allam-2-7b",
    label: "Allam 2 7B",
    description: "Lightweight multilingual model for compact debugging help."
  },
  {
    id: "groq/compound",
    label: "Compound",
    description: "Best default for strong reasoning and richer debugging help."
  },
  {
    id: "groq/compound-mini",
    label: "Compound Mini",
    description: "Faster and lighter for quick AI triage."
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    description: "Fastest option for lightweight issue summaries."
  },
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    description: "High-depth analysis for complex debugging workflows."
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    description: "Balanced quality and speed for everyday issue analysis."
  }
] as const;

const legacyAiModelAliases: Record<string, string> = {
  compound: "groq/compound",
  "compound-mini": "groq/compound-mini",
  "gpt-oss-120b": "openai/gpt-oss-120b",
  "gpt-oss-20b": "openai/gpt-oss-20b"
};

export const normalizeAiModelId = (value: string | null | undefined) => {
  if (!value) {
    return value;
  }

  const trimmed = value.trim();
  return legacyAiModelAliases[trimmed] || trimmed;
};

export const defaultAiModel =
  process.env.GROQ_MODEL && supportedAiModels.some((model) => model.id === process.env.GROQ_MODEL)
    ? process.env.GROQ_MODEL
    : "groq/compound";

export const isSupportedAiModel = (value: string) => {
  const normalized = normalizeAiModelId(value);
  return normalized ? supportedAiModels.some((model) => model.id === normalized) : false;
};

export const resolveAiModel = (value: string | null | undefined) =>
  value && isSupportedAiModel(value) ? normalizeAiModelId(value) : defaultAiModel;
