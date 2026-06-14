type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

type StructuredAiExplanation = {
  summary: string;
  rootCause: string;
  recommendedFix: string;
  nextSteps: string[];
};

const groqApiKey = process.env.GROQ_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const groqModel = process.env.GROQ_MODEL || "groq/compound";
const supportedAiModels = new Set([
  "allam-2-7b",
  "groq/compound",
  "groq/compound-mini",
  "gemini/gemini-1.5-flash",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b"
]);
const resolveAiModel = (value?: string) =>
  value && supportedAiModels.has(value) ? value : groqModel;

const normalizeStructuredResponse = (
  value: Partial<StructuredAiExplanation> | null | undefined
): StructuredAiExplanation => {
  const nextSteps = Array.isArray(value?.nextSteps)
    ? value?.nextSteps
        .map((step) => (typeof step === "string" ? step.trim() : ""))
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return {
    summary: value?.summary?.trim() || "The error needs a closer review.",
    rootCause: value?.rootCause?.trim() || "The exact root cause could not be confidently inferred.",
    recommendedFix:
      value?.recommendedFix?.trim() || "Inspect the stack trace and surrounding code path, then retry.",
    nextSteps:
      nextSteps.length > 0
        ? nextSteps
        : ["Inspect the failing code path.", "Validate the input and environment around the error."]
  };
};

const tryParseStructuredResponse = (content: string): StructuredAiExplanation | null => {
  try {
    const parsed = JSON.parse(content) as Partial<StructuredAiExplanation>;
    return normalizeStructuredResponse(parsed);
  } catch {
    return null;
  }
};

export const generateExplanation = async (input: {
  message: string;
  stackTrace: string;
  model?: string;
  timeoutMs?: number;
}) => {
  const resolvedModel = resolveAiModel(input.model);
  const isGemini = resolvedModel.startsWith("gemini/");

  if (isGemini && !geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  } else if (!isGemini && !groqApiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const timeoutMs = Math.max(5_000, input.timeoutMs ?? 45_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const messages: GroqMessage[] = [
    {
      role: "system",
      content:
        'You are an expert debugging assistant. Return only valid JSON with this exact shape: {"summary":"...","rootCause":"...","recommendedFix":"...","nextSteps":["..."]}. Keep each field concise, practical, and developer-focused. nextSteps must contain 2 to 4 short action items.'
    },
    {
      role: "user",
      content: `Error message:\n${input.message}\n\nStack trace:\n${input.stackTrace}`
    }
  ];

  let response: Response;
  try {
    if (isGemini) {
      const modelName = resolvedModel.replace("gemini/", "");
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: messages[1].content }] }],
          systemInstruction: { parts: [{ text: messages[0].content }] },
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        }),
        signal: controller.signal
      });
    } else {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages,
          temperature: 0.2,
          response_format: {
            type: "json_object"
          }
        }),
        signal: controller.signal
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Groq request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error: ${response.status} ${errorBody}`);
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

  const structured = tryParseStructuredResponse(content);
  if (!structured) {
    throw new Error("Groq response was not valid structured JSON");
  }

  return structured;
};
