type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

const groqApiKey = process.env.GROQ_API_KEY;
const groqModel = process.env.GROQ_MODEL || "llama-3.1-70b-versatile";

export const generateExplanation = async (input: {
  message: string;
  stackTrace: string;
}) => {
  if (!groqApiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const messages: GroqMessage[] = [
    {
      role: "system",
      content:
        "You are an expert debugging assistant. Explain the root cause of the error and propose a concise fix. Keep it practical and developer-focused."
    },
    {
      role: "user",
      content: `Error message:\n${input.message}\n\nStack trace:\n${input.stackTrace}`
    }
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqApiKey}`
    },
    body: JSON.stringify({
      model: groqModel,
      messages,
      temperature: 0.2
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

  return content;
};
