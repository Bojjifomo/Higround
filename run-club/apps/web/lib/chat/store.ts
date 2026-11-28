/**
 * In-memory live MMORPG World Chat store (ring buffer + per-user rate limit).
 * Shared across requests inside the Node/PM2 server process just like live presence.
 */
import { checkProfanity } from "./profanity";

export interface WorldChatMessage {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  level: number;
  text: string;
  createdAt: number;
}

export const CHAT_MAX_LEN = 140;
export const CHAT_RATE_LIMIT_MS = 2000;
const CHAT_BUFFER_LIMIT = 80;

interface ChatState {
  messages: WorldChatMessage[];
  lastSentByUser: Map<string, number>;
  seq: number;
}

const g = globalThis as unknown as { __hgWorldChat?: ChatState };
function state(): ChatState {
  g.__hgWorldChat ??= { messages: [], lastSentByUser: new Map(), seq: 0 };
  return g.__hgWorldChat;
}

export function listChatMessages(since = 0, limit = 40): WorldChatMessage[] {
  const all = state().messages;
  const filtered = since > 0 ? all.filter((m) => m.createdAt > since) : all;
  return filtered.slice(-limit);
}

export type PostChatOutcome =
  | { ok: true; message: WorldChatMessage }
  | { ok: false; error: string; status: number };

export function postChatMessage(
  sender: { userId: string; handle: string; displayName: string; level: number },
  rawText: string,
  now: number = Date.now(),
): PostChatOutcome {
  const s = state();
  const last = s.lastSentByUser.get(sender.userId) ?? 0;
  if (now - last < CHAT_RATE_LIMIT_MS) {
    return { ok: false, error: "Santai dulu bentar (tunggu 2 detik sebelum kirim pesan lagi).", status: 429 };
  }

  const trimmed = rawText.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return { ok: false, error: "Tulis pesan dulu sebelum kirim.", status: 400 };
  }
  if (trimmed.length > CHAT_MAX_LEN) {
    return { ok: false, error: `Pesan maksimal ${CHAT_MAX_LEN} karakter.`, status: 400 };
  }

  const prof = checkProfanity(trimmed);
  if (!prof.ok) {
    return { ok: false, error: prof.reason, status: 400 };
  }

  const msg: WorldChatMessage = {
    id: `m-${now}-${++s.seq}`,
    userId: sender.userId,
    handle: sender.handle,
    displayName: sender.displayName,
    level: sender.level,
    text: prof.clean,
    createdAt: now,
  };
  s.messages.push(msg);
  if (s.messages.length > CHAT_BUFFER_LIMIT) {
    s.messages.splice(0, s.messages.length - CHAT_BUFFER_LIMIT);
  }
  s.lastSentByUser.set(sender.userId, now);
  return { ok: true, message: msg };
}

export function resetChatStoreForTests() {
  const s = state();
  s.messages = [];
  s.lastSentByUser.clear();
  s.seq = 0;
}
