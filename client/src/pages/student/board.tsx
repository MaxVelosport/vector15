import "@excalidraw/excalidraw/index.css";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import { useEffect, useRef, useCallback, useState } from "react";
import { useLocation } from "wouter";
import { Wifi, WifiOff, Loader2, ArrowLeft, Download, ImagePlus, HelpCircle, X, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { toast } from "@/lib/toast";

type SyncStatus = "connecting" | "connected" | "disconnected";

type ExcalidrawCollaborator = {
  pointer?: { x: number; y: number; tool: "pointer" };
  button?: "up" | "down";
  username?: string;
  color?: { background: string; stroke: string };
  socketId?: string;
};

function mergeElements(local: any[], remote: any[]): any[] {
  const merged = new Map<string, any>();
  for (const el of local) merged.set(el.id, el);
  for (const el of remote) {
    const localEl = merged.get(el.id);
    if (!localEl || (el.version ?? 0) >= (localEl.version ?? 0)) {
      merged.set(el.id, el);
    }
  }
  return Array.from(merged.values());
}

const SHORTCUTS = [
  { keys: ["V"], desc: "Выделение" },
  { keys: ["H"], desc: "Перемещение" },
  { keys: ["R"], desc: "Прямоугольник" },
  { keys: ["E"], desc: "Эллипс" },
  { keys: ["A"], desc: "Стрелка" },
  { keys: ["P"], desc: "Карандаш" },
  { keys: ["T"], desc: "Текст" },
  { keys: ["9"], desc: "Изображение" },
  { keys: ["Ctrl", "V"], desc: "Вставить фото/скриншот" },
  { keys: ["Ctrl", "Z"], desc: "Отменить" },
  { keys: ["Del"], desc: "Удалить элемент" },
];

interface StudentBoardProps {
  studentId: string;
  studentName: string;
}

export default function StudentBoard({ studentId, studentName }: StudentBoardProps) {
  const [, setLocation] = useLocation();
  const { theme } = useTheme();

  const apiRef           = useRef<any>(null);
  const wsRef            = useRef<WebSocket | null>(null);
  const debounceRef      = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const curDeb           = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingSnapshotRef = useRef<any>(null);
  const lastSentJsonRef  = useRef<string>("");
  const suppressSendRef  = useRef(false);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const collaboratorsRef = useRef<Map<string, ExcalidrawCollaborator>>(new Map());
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [showHelp, setShowHelp] = useState(false);

  const applyRemote = useCallback((remoteElements: any[]) => {
    const api = apiRef.current;
    if (!api) return;
    const localElements = api.getSceneElements();
    const merged = mergeElements(Array.from(localElements), remoteElements);
    suppressSendRef.current = true;
    api.updateScene({ elements: merged });
    requestAnimationFrame(() => { suppressSendRef.current = false; });
  }, []);

  useEffect(() => {
    if (!studentId) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (destroyed) return;

      // Fetch a short-lived WS auth token from the server
      let token: string;
      try {
        const res = await fetch("/api/student/board/ws-token", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          setStatus("disconnected");
          if (!destroyed) reconnectTimer = setTimeout(connect, 5000);
          return;
        }
        const data = await res.json();
        token = data.token;
      } catch {
        setStatus("disconnected");
        if (!destroyed) reconnectTimer = setTimeout(connect, 5000);
        return;
      }

      if (destroyed) return;
      setStatus("connecting");

      const ws = new WebSocket(
        `${protocol}//${window.location.host}/ws/board?studentId=${studentId}&token=${token}`
      );
      wsRef.current = ws;

      ws.onopen = () => setStatus("connected");
      ws.onclose = () => {
        setStatus("disconnected");
        collaboratorsRef.current = new Map();
        apiRef.current?.updateScene({ collaborators: new Map() });
        if (!destroyed) reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => setStatus("disconnected");

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "snapshot" && Array.isArray(msg.snapshot?.elements)) {
            const remoteElements = msg.snapshot.elements;
            if (apiRef.current) {
              applyRemote(remoteElements);
            } else {
              pendingSnapshotRef.current = remoteElements;
            }
          } else if (msg.type === "cursor" && msg.x != null) {
            const { socketId, x, y, name, color } = msg;
            const nextMap = new Map(collaboratorsRef.current);
            nextMap.set(socketId, {
              pointer: { x, y, tool: "pointer" as const },
              button: "up" as const,
              username: name ?? "Участник",
              color,
            });
            collaboratorsRef.current = nextMap;
            apiRef.current?.updateScene({ collaborators: nextMap });
          } else if (msg.type === "cursor_leave") {
            const nextMap = new Map(collaboratorsRef.current);
            nextMap.delete(msg.socketId);
            collaboratorsRef.current = nextMap;
            apiRef.current?.updateScene({ collaborators: nextMap });
          }
        } catch {}
      };
    };

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearTimeout(debounceRef.current);
      wsRef.current?.close();
      collaboratorsRef.current = new Map();
      apiRef.current?.updateScene({ collaborators: new Map() });
    };
  }, [studentId, applyRemote]);

  const handleMount = useCallback((api: any) => {
    apiRef.current = api;
    if (pendingSnapshotRef.current) {
      suppressSendRef.current = true;
      api.updateScene({ elements: pendingSnapshotRef.current });
      pendingSnapshotRef.current = null;
      requestAnimationFrame(() => { suppressSendRef.current = false; });
    }
  }, []);

  const handleChange = useCallback((elements: readonly any[]) => {
    if (suppressSendRef.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const json = JSON.stringify(elements);
      if (json === lastSentJsonRef.current) return;
      lastSentJsonRef.current = json;
      wsRef.current.send(JSON.stringify({ type: "update", snapshot: { elements } }));
    }, 150);
  }, []);

  const handlePointerUpdate = useCallback((payload: { pointer: { x: number; y: number } }) => {
    if (curDeb.current) clearTimeout(curDeb.current);
    curDeb.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "cursor",
          x: payload.pointer.x,
          y: payload.pointer.y,
          name: studentName ?? "Ученик",
        }));
      }
    }, 40);
  }, [studentName]);

  const handleExportPNG = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    if (!elements.length) {
      toast.error("Доска пустая — нечего сохранять");
      return;
    }
    try {
      const blob = await exportToBlob({
        elements,
        appState: { exportWithDarkMode: theme === "dark" },
        files: api.getFiles?.() ?? null,
        mimeType: "image/png",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "доска-урок.png";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Изображение сохранено");
    } catch {
      toast.error("Не удалось сохранить");
    }
  }, [theme]);

  const handleImageUpload = useCallback((file: File) => {
    const api = apiRef.current;
    if (!api) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const id = Math.random().toString(36).slice(2);
        const fileId = `img-${id}` as any;
        api.addFiles([{ id: fileId, dataURL: dataUrl, mimeType: file.type as any, created: Date.now() }]);
        const maxW = 600;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        api.updateScene({
          elements: [
            ...api.getSceneElements(),
            {
              type: "image",
              id,
              x: 100 + Math.random() * 100,
              y: 100 + Math.random() * 100,
              width: w,
              height: h,
              angle: 0,
              strokeColor: "transparent",
              backgroundColor: "transparent",
              fillStyle: "solid",
              strokeWidth: 1,
              roughness: 0,
              opacity: 100,
              groupIds: [],
              seed: Math.round(Math.random() * 1e9),
              version: 1,
              versionNonce: Math.round(Math.random() * 1e9),
              isDeleted: false,
              boundElements: null,
              updated: Date.now(),
              link: null,
              locked: false,
              frameId: null,
              status: "saved",
              fileId,
              scale: [1, 1],
            },
          ],
        });
        toast.success("Изображение добавлено");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground h-7 px-2"
            data-testid="button-board-back"
            onClick={() => setLocation("/student")}
          >
            <ArrowLeft className="h-4 w-4" /> Назад
          </Button>
          <div className="w-px h-4 bg-border" />
          <span className="text-sm font-medium">Совместная доска</span>
        </div>
        <div className="flex items-center gap-1.5">
          {status === "connecting" && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Подключение...
            </span>
          )}
          {status === "connected" && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
              <Wifi className="h-3 w-3" /> В сети
            </span>
          )}
          {status === "disconnected" && (
            <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              <WifiOff className="h-3 w-3" /> Нет связи
            </span>
          )}
          <div className="w-px h-4 bg-border mx-1" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = "";
            }}
          />
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => fileInputRef.current?.click()} title="Загрузить фото">
            <ImagePlus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleExportPNG} title="Сохранить как PNG">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowHelp(true)} title="Горячие клавиши">
            <HelpCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <Excalidraw
          excalidrawAPI={handleMount}
          onChange={handleChange}
          onPointerUpdate={handlePointerUpdate}
          theme={theme === "dark" ? "dark" : "light"}
          langCode="ru-RU"
          initialData={{ appState: { viewBackgroundColor: theme === "dark" ? "#1a1b1e" : "#f8f9fb" } }}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: { saveFileToDisk: false },
              toggleTheme: false,
            },
          }}
        />
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-background rounded-2xl border shadow-2xl p-5 max-w-sm w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Горячие клавиши</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowHelp(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                  <span className="text-xs text-muted-foreground">{s.desc}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, ki) => (
                      <span key={ki} className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono font-medium">{k}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-2.5 text-xs text-muted-foreground">
              <strong className="text-foreground">Совет:</strong> Сделайте скриншот (Win+Shift+S или Cmd+Ctrl+Shift+4), скопируйте изображение и нажмите <span className="font-mono bg-muted px-1 rounded">Ctrl+V</span> на доске.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
