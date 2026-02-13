import type { AiChatMessage } from "@/ai/types";

export function getLastUserText(messages: readonly AiChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return messages[i]!.content;
  }
  return "";
}

export function promptMentionsPartner(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(wife|husband|partner|spouse|girlfriend|boyfriend)\b/.test(t);
}

