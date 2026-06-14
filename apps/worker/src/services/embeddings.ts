const geminiApiKey = process.env.GEMINI_API_KEY;

export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (!geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY for embeddings");
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: {
        parts: [{ text }]
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate embedding: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const values = data.embedding?.values;

  if (!Array.isArray(values)) {
    throw new Error("Invalid embedding response from Gemini API");
  }

  return values as number[];
};
