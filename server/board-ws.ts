import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { randomUUID } from "crypto";
import { supabase } from "./supabase";

const TABLE = "Tvoy_vector_2_boards";

// ── In-memory room registry ──────────────────────────────────────────────────
const rooms = new Map<string, Set<WebSocket>>();
const roomLastEmpty = new Map<string, number>();
const IDLE_CLEANUP_MS = 30 * 60 * 1000;

// Connection metadata
interface ConnMeta {
  role: "tutor" | "student";
  userId: string;
  studentId: string;
}
const connMeta = new WeakMap<WebSocket, ConnMeta>();

// ── Short-lived WS tokens ─────────────────────────────────────────────────────
interface WsToken {
  studentId: string;
  role: "tutor" | "student";
  userId: string;     // tutorId or studentId
  expires: number;    // unix ms
}

const pendingTokens = new Map<string, WsToken>();
const TOKEN_TTL_MS = 45_000; // 45 seconds

setInterval(() => {
  const now = Date.now();
  for (const [tok, data] of pendingTokens) {
    if (data.expires < now) pendingTokens.delete(tok);
  }
}, 60_000);

/**
 * Generate a one-time WS auth token for a board session.
 * Called from REST routes after validating the user's session.
 */
export function generateBoardWsToken(
  studentId: string,
  role: "tutor" | "student",
  userId: string,
): string {
  const token = randomUUID();
  pendingTokens.set(token, {
    studentId,
    role,
    userId,
    expires: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

// ── Persistence ───────────────────────────────────────────────────────────────
function isTempRoom(studentId: string): boolean {
  return studentId.startsWith("temp-");
}

async function getSnapshot(studentId: string): Promise<any | null> {
  if (isTempRoom(studentId)) return null;
  try {
    const { data } = await supabase
      .from(TABLE)
      .select("snapshot")
      .eq("student_id", studentId)
      .single();
    return data?.snapshot ?? null;
  } catch {
    return null;
  }
}

async function saveSnapshot(studentId: string, snapshot: any): Promise<void> {
  if (isTempRoom(studentId)) return;
  await supabase.from(TABLE).upsert(
    { student_id: studentId, snapshot, updated_at: new Date().toISOString() },
    { onConflict: "student_id" }
  );
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
function startIdleCleanup() {
  setInterval(() => {
    const now = Date.now();
    for (const [studentId, lastEmpty] of Array.from(roomLastEmpty.entries())) {
      if (now - lastEmpty > IDLE_CLEANUP_MS) {
        rooms.delete(studentId);
        roomLastEmpty.delete(studentId);
      }
    }
  }, 5 * 60 * 1000);
}

// ── Main setup ────────────────────────────────────────────────────────────────
export function setupBoardWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/board" });

  startIdleCleanup();

  wss.on("connection", async (ws: WebSocket, req) => {
    const url = new URL(req.url!, `http://localhost`);
    const token     = url.searchParams.get("token");
    const studentId = url.searchParams.get("studentId");

    // ── Authenticate ──────────────────────────────────────────────────────
    if (!token) {
      ws.close(1008, "Authentication required: missing token");
      return;
    }

    const tokenData = pendingTokens.get(token);
    pendingTokens.delete(token); // one-time use

    if (!tokenData) {
      ws.close(1008, "Authentication failed: invalid token");
      return;
    }
    if (tokenData.expires < Date.now()) {
      ws.close(1008, "Authentication failed: token expired");
      return;
    }
    if (studentId && tokenData.studentId !== studentId) {
      ws.close(1008, "Authentication failed: studentId mismatch");
      return;
    }

    const roomId = tokenData.studentId;
    const meta: ConnMeta = {
      role: tokenData.role,
      userId: tokenData.userId,
      studentId: roomId,
    };
    connMeta.set(ws, meta);

    // ── Join room ─────────────────────────────────────────────────────────
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    const room = rooms.get(roomId)!;
    room.add(ws);
    roomLastEmpty.delete(roomId);

    // Send current snapshot to the new client
    try {
      const snapshot = await getSnapshot(roomId);
      if (snapshot && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "snapshot", snapshot }));
      }
    } catch {}

    // Notify others that someone joined (for presence)
    const joinMsg = JSON.stringify({ type: "peer_join", role: meta.role });
    for (const client of Array.from(room)) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(joinMsg);
      }
    }

    // ── Handle messages ───────────────────────────────────────────────────
    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "update" && msg.snapshot) {
          // Persist and broadcast to room peers
          saveSnapshot(roomId, msg.snapshot).catch(() => {});
          const broadcast = JSON.stringify({ type: "snapshot", snapshot: msg.snapshot, role: meta.role });
          for (const client of Array.from(room)) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(broadcast);
            }
          }
        } else if (msg.type === "cursor" && msg.x != null) {
          // Relay cursor position with sender's role
          const cursor = JSON.stringify({ type: "cursor", x: msg.x, y: msg.y, name: msg.name, role: meta.role });
          for (const client of Array.from(room)) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(cursor);
            }
          }
        }
      } catch {}
    });

    // ── Cleanup on disconnect ─────────────────────────────────────────────
    const cleanup = () => {
      room.delete(ws);
      if (room.size === 0) {
        roomLastEmpty.set(roomId, Date.now());
      }
      // Notify peers that user left
      const leaveMsg = JSON.stringify({ type: "cursor_leave", role: meta.role });
      for (const client of Array.from(room)) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(leaveMsg);
        }
      }
    };

    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });

  console.log("✅ Board WebSocket ready at /ws/board (authenticated)");
}
