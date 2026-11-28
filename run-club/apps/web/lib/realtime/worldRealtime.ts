"use client";
/**
 * Supabase Realtime Broadcast bridge for /world (Plan B):
 * - Streams live Gamepad/WASD avatar movement between online players (<100ms)
 * - Broadcasts World Chat messages immediately so bubbles pop up without waiting for 4s poll
 * - Automatically no-ops cleanly in demo mode or when NEXT_PUBLIC_SUPABASE_* is unset
 */
import { createBrowserClient } from "@supabase/ssr";
import type { WorldChatMessage } from "@/lib/chat/store";
import type { SceneKey } from "@/lib/world/layout";

export interface RemoteMovePayload {
  userId: string;
  scene: SceneKey;
  x: number;
  y: number;
  facing: 1 | -1;
  moving: boolean;
}

export interface WorldRealtimeHandle {
  readonly enabled: boolean;
  broadcastMove(payload: RemoteMovePayload): void;
  broadcastChat(msg: WorldChatMessage): void;
  disconnect(): void;
}

const NOOP_HANDLE: WorldRealtimeHandle = {
  enabled: false,
  broadcastMove() {},
  broadcastChat() {},
  disconnect() {},
};

export function connectWorldRealtime(opts: {
  myUserId: string | null;
  onRemoteMove: (payload: RemoteMovePayload) => void;
  onRemoteChat: (msg: WorldChatMessage) => void;
  onStatus?: (connected: boolean) => void;
}): WorldRealtimeHandle {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon || typeof window === "undefined") {
    return NOOP_HANDLE;
  }

  let client: ReturnType<typeof createBrowserClient>;
  try {
    client = createBrowserClient(url, anon);
  } catch {
    return NOOP_HANDLE;
  }

  const channel = client.channel("higround-world-live", {
    config: { broadcast: { self: false } },
  });

  let subscribed = false;
  let lastMoveSent = 0;

  channel
    .on("broadcast", { event: "move" }, ({ payload }: { payload: unknown }) => {
      const p = payload as Partial<RemoteMovePayload> | undefined;
      if (!p || !p.userId || p.userId === opts.myUserId) return;
      if (typeof p.x !== "number" || typeof p.y !== "number" || !p.scene) return;
      opts.onRemoteMove({
        userId: p.userId,
        scene: p.scene,
        x: p.x,
        y: p.y,
        facing: p.facing === -1 ? -1 : 1,
        moving: Boolean(p.moving),
      });
    })
    .on("broadcast", { event: "chat" }, ({ payload }: { payload: unknown }) => {
      const m = payload as WorldChatMessage | undefined;
      if (!m || !m.id || !m.text) return;
      opts.onRemoteChat(m);
    })
    .subscribe((status: string) => {
      subscribed = status === "SUBSCRIBED";
      opts.onStatus?.(subscribed);
    });

  return {
    get enabled() {
      return subscribed;
    },
    broadcastMove(payload) {
      if (!subscribed) return;
      const now = Date.now();
      if (now - lastMoveSent < 110) return; // ~9 Hz smooth multiplayer sync
      lastMoveSent = now;
      void channel.send({ type: "broadcast", event: "move", payload });
    },
    broadcastChat(msg) {
      if (!subscribed) return;
      void channel.send({ type: "broadcast", event: "chat", payload: msg });
    },
    disconnect() {
      subscribed = false;
      void client.removeChannel(channel);
    },
  };
}
