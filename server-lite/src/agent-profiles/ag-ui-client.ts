/**
 * Client AG-UI minimal : un tour user → assistant via HTTP JSON.
 * Compatible avec les endpoints qui acceptent POST { messages, threadId }.
 */
export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function runAgUiTurn(options: {
  endpoint: string;
  threadId: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}): Promise<string> {
  const res = await fetch(options.endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      threadId: options.threadId,
      messages: options.messages,
    }),
    signal: options.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AG-UI ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    content?: string;
    message?: { content?: string };
    text?: string;
  };
  const content =
    data.content ?? data.message?.content ?? data.text ?? JSON.stringify(data);
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Réponse AG-UI sans contenu texte.");
  }
  return content;
}
