// Cohere Chat API v2 service
// Docs: https://docs.cohere.com/reference/chat

const COHERE_URL = "https://api.cohere.com/v2/chat";
const MODEL = "command-a-03-2025";
const TIMEOUT_MS = 30000;

export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CohereChatResult {
  text: string;
  finishReason?: string;
}

export async function callCohereChat(messages: ChatMessage[]): Promise<CohereChatResult> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) throw new Error("COHERE_API_KEY is not configured on the server");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(COHERE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Cohere API error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data: any = await res.json();
    const text =
      data?.message?.content?.[0]?.text ??
      data?.text ??
      "";
    return { text: String(text || "").trim(), finishReason: data?.finish_reason };
  } finally {
    clearTimeout(timeout);
  }
}
