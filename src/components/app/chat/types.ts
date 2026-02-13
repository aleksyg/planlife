export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  /** Markdown content for assistant; plain text for user. */
  content: string;
};

