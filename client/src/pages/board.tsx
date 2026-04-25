import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Wifi,
  WifiOff,
  Loader2,
  Trash2,
  Download,
  HelpCircle,
  ImagePlus,
  X,
  Archive,
  RotateCcw,
  Triangle,
  LayoutTemplate,
  MousePointer2,
  Hand,
  Pencil,
  Eraser,
  Type,
  Square,
  Circle,
  Diamond,
  ArrowUpRight,
  Minus,
  Undo2,
  Redo2,
  Plus,
  MoreHorizontal,
  Sparkles,
  Frame as FrameIcon,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SyncStatus = "connecting" | "connected" | "disconnected";

// ── Helpers ──────────────────────────────────────────────────────────────────
function newId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}
function rand() {
  return Math.floor(Math.random() * 2147483647);
}
function baseEl(type: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}) {
  return {
    id: newId(), type, x, y, width: w, height: h, angle: 0,
    strokeColor: "#1e1e1e", backgroundColor: "transparent",
    fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid",
    roughness: 1, opacity: 100, groupIds: [] as string[],
    frameId: null, roundness: null,
    seed: rand(), version: 1, versionNonce: rand(),
    isDeleted: false, boundElements: null,
    updated: Date.now(), link: null, locked: false,
    ...extra,
  };
}
function arrowEl(x: number, y: number, dx: number, dy: number) {
  return {
    ...baseEl("arrow", x, y, Math.abs(dx), Math.abs(dy)),
    points: [[0, 0], [dx, dy]] as [number, number][],
    lastCommittedPoint: null, startBinding: null, endBinding: null,
    startArrowhead: null, endArrowhead: "arrow",
  };
}
function textEl(x: number, y: number, text: string, fontSize = 18) {
  return {
    ...baseEl("text", x, y, text.length * fontSize * 0.6, fontSize * 1.3),
    text, fontSize, fontFamily: 1, textAlign: "left" as const,
    verticalAlign: "top" as const,
    containerId: null, originalText: text, lineHeight: 1.25, baseline: Math.floor(fontSize * 0.9),
  };
}
// Замкнутый многоугольник как line-элемент Excalidraw
function polyEl(x: number, y: number, points: [number, number][], fill = "transparent", stroke = "#1e1e1e") {
  const xs = points.map(p => p[0]); const ys = points.map(p => p[1]);
  const w = Math.max(...xs) - Math.min(...xs); const h = Math.max(...ys) - Math.min(...ys);
  const closed: [number, number][] = [...points, points[0]];
  return {
    ...baseEl("line", x, y, w, h),
    points: closed,
    backgroundColor: fill, fillStyle: fill === "transparent" ? "hachure" : "solid",
    strokeColor: stroke, roughness: 0,
    lastCommittedPoint: null, startBinding: null, endBinding: null,
    startArrowhead: null, endArrowhead: null,
  };
}

// ── Геометрические пресеты ───────────────────────────────────────────────────
type GeoPreset = { type: string; label: string; icon: string; build: (cx: number, cy: number) => object[] };

const GEO_PRESETS: GeoPreset[] = [
  // ── Базовые ────────────────────────────────────────────
  { type: "rect",      label: "Прямоугольник", icon: "▭",
    build: (cx,cy) => [baseEl("rectangle", cx-120, cy-75, 240, 150, { roughness: 0 })] },
  { type: "square",    label: "Квадрат",       icon: "□",
    build: (cx,cy) => [baseEl("rectangle", cx-100, cy-100, 200, 200, { roughness: 0 })] },
  { type: "circle",    label: "Окружность",    icon: "○",
    build: (cx,cy) => [baseEl("ellipse", cx-100, cy-100, 200, 200, { roughness: 0 })] },
  { type: "ellipse",   label: "Эллипс",        icon: "⬭",
    build: (cx,cy) => [baseEl("ellipse", cx-130, cy-80, 260, 160, { roughness: 0 })] },
  { type: "diamond",   label: "Ромб",          icon: "◇",
    build: (cx,cy) => [baseEl("diamond", cx-110, cy-90, 220, 180, { roughness: 0 })] },

  // ── Треугольники ───────────────────────────────────────
  { type: "tri-eq",    label: "Треугольник равносторонний", icon: "△",
    build: (cx,cy) => [polyEl(cx-110, cy-95, [[0,180],[110,0],[220,180]])] },
  { type: "tri-iso",   label: "Равнобедренный",    icon: "▲",
    build: (cx,cy) => [polyEl(cx-100, cy-100, [[0,200],[100,0],[200,200]])] },
  { type: "tri-right", label: "Прямоугольный",     icon: "◣",
    build: (cx,cy) => [polyEl(cx-100, cy-90,  [[0,180],[0,0],[200,180]])] },

  // ── Многоугольники ─────────────────────────────────────
  { type: "parallelo", label: "Параллелограмм",  icon: "▱",
    build: (cx,cy) => [polyEl(cx-130, cy-60, [[40,0],[260,0],[220,120],[0,120]])] },
  { type: "trapezoid", label: "Трапеция",         icon: "⏢",
    build: (cx,cy) => [polyEl(cx-130, cy-60, [[60,0],[200,0],[260,120],[0,120]])] },
  { type: "pentagon",  label: "Пятиугольник",     icon: "⬠",
    build: (cx,cy) => {
      const r = 110, pts: [number,number][] = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI/2 + i * 2*Math.PI/5;
        pts.push([110 + r*Math.cos(a), 110 + r*Math.sin(a)]);
      }
      return [polyEl(cx-110, cy-110, pts)];
    }},
  { type: "hexagon",   label: "Шестиугольник",    icon: "⬡",
    build: (cx,cy) => {
      const r = 110, pts: [number,number][] = [];
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI/3;
        pts.push([110 + r*Math.cos(a), 110 + r*Math.sin(a)]);
      }
      return [polyEl(cx-110, cy-110, pts)];
    }},
  { type: "octagon",   label: "Восьмиугольник",   icon: "⯃",
    build: (cx,cy) => {
      const r = 110, pts: [number,number][] = [];
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI/8 + i * 2*Math.PI/8;
        pts.push([110 + r*Math.cos(a), 110 + r*Math.sin(a)]);
      }
      return [polyEl(cx-110, cy-110, pts)];
    }},
  { type: "star",      label: "Звезда",           icon: "★",
    build: (cx,cy) => {
      const R = 110, r = 50, pts: [number,number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI/2 + i * Math.PI/5;
        const rad = i % 2 === 0 ? R : r;
        pts.push([110 + rad*Math.cos(a), 110 + rad*Math.sin(a)]);
      }
      return [polyEl(cx-110, cy-110, pts, "#ffec99", "#fab005")];
    }},

  // ── 3D-фигуры ──────────────────────────────────────────
  { type: "cube",      label: "Куб",              icon: "▣",
    build: (cx,cy) => {
      const s = 130, d = 50;
      return [
        polyEl(cx-s/2, cy-s/2,    [[0,0],[s,0],[s,s],[0,s]]),
        polyEl(cx-s/2, cy-s/2,    [[0,0],[d,-d],[s+d,-d],[s,0]]),
        polyEl(cx-s/2+s, cy-s/2,  [[0,0],[d,-d],[d,s-d],[0,s]]),
      ];
    }},
  { type: "cylinder",  label: "Цилиндр",          icon: "⌭",
    build: (cx,cy) => [
      baseEl("ellipse", cx-70, cy-110, 140, 40, { roughness: 0 }),
      baseEl("ellipse", cx-70, cy+70,  140, 40, { roughness: 0 }),
      baseEl("line", cx-70, cy-90, 0, 180, { roughness: 0, points: [[0,0],[0,180]] as any }),
      baseEl("line", cx+70, cy-90, 0, 180, { roughness: 0, points: [[0,0],[0,180]] as any }),
    ]},
  { type: "cone",      label: "Конус",            icon: "▽",
    build: (cx,cy) => [
      polyEl(cx-100, cy-110, [[100,0],[200,180],[0,180]]),
      baseEl("ellipse", cx-100, cy+50, 200, 40, { roughness: 0 }),
    ]},
  { type: "pyramid",   label: "Пирамида",         icon: "◮",
    build: (cx,cy) => {
      const w = 200, h = 180, d = 40;
      return [
        polyEl(cx-w/2, cy-h/2, [[w/2,0],[w,h-d],[w/2-d,h]]),
        polyEl(cx-w/2, cy-h/2, [[w/2,0],[w/2-d,h],[0,h-d]]),
        polyEl(cx-w/2, cy-h/2, [[0,h-d],[w/2-d,h],[w,h-d]]),
      ];
    }},
  { type: "sphere",    label: "Шар",              icon: "⬤",
    build: (cx,cy) => [
      baseEl("ellipse", cx-100, cy-100, 200, 200, { roughness: 0 }),
      baseEl("ellipse", cx-100, cy-30,  200, 60,  { roughness: 0, strokeStyle: "dashed" }),
    ]},

  // ── Учебные ───────────────────────────────────────────
  { type: "axes",      label: "Оси координат",    icon: "✛",
    build: (cx,cy) => [
      arrowEl(cx-180, cy, 360, 0),
      arrowEl(cx, cy+180, 0, -360),
      textEl(cx+186, cy-10, "x"),
      textEl(cx-12, cy-196, "y"),
    ]},
  { type: "numline",   label: "Числовая прямая",  icon: "↔",
    build: (cx,cy) => [
      arrowEl(cx-200, cy, 400, 0),
      ...[-4,-3,-2,-1,0,1,2,3,4].map(n => textEl(cx + n*44 - 6, cy+8, String(n), 14)),
    ]},
  { type: "rightangle", label: "Прямой угол",     icon: "∟",
    build: (cx,cy) => [
      arrowEl(cx, cy+120, 0, -120),
      arrowEl(cx, cy+120, 120, 0),
      { ...baseEl("rectangle", cx+2, cy+100, 20, 20), strokeWidth: 1, roughness: 0 },
    ]},
  { type: "angle",     label: "Угол",             icon: "∠",
    build: (cx,cy) => [
      arrowEl(cx-100, cy+80, 200, 0),
      arrowEl(cx-100, cy+80, 180, -120),
      textEl(cx-70, cy+40, "α", 16),
    ]},
  { type: "note",      label: "Стикер",           icon: "🗒",
    build: (cx,cy) => [
      { ...baseEl("rectangle", cx-100, cy-60, 200, 120),
        backgroundColor: "#fff3bf", strokeColor: "#f0c000",
        fillStyle: "solid" as const, roughness: 0 },
      textEl(cx-80, cy-40, "Заметка"),
    ]},
];

// ── Шаблоны ──────────────────────────────────────────────────────────────────
type BoardTemplate = { id: string; label: string; icon: string; build: () => object[] };

const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "task", label: "Разбор задачи", icon: "📋",
    build: () => [
      { ...baseEl("rectangle", 40,  80, 280, 200), backgroundColor: "#fff3bf", fillStyle: "solid", roughness: 0, strokeColor: "#f0c000" },
      { ...baseEl("rectangle", 360, 80, 280, 200), backgroundColor: "#dbe4ff", fillStyle: "solid", roughness: 0, strokeColor: "#4c6ef5" },
      { ...baseEl("rectangle", 680, 80, 280, 200), backgroundColor: "#d3f9d8", fillStyle: "solid", roughness: 0, strokeColor: "#2f9e44" },
      textEl(160, 160, "Условие", 20),
      textEl(480, 160, "Решение", 20),
      textEl(790, 160, "Ответ",   20),
    ],
  },
  {
    id: "brainstorm", label: "Мозговой штурм", icon: "💡",
    build: () => {
      const els: object[] = [];
      els.push({ ...baseEl("ellipse", 330, 180, 200, 100), backgroundColor: "#fff3bf", fillStyle: "solid", roughness: 0 });
      els.push(textEl(380, 220, "Идея", 18));
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        const bx = 430 + Math.cos(a) * 240 - 80;
        const by = 230 + Math.sin(a) * 160 - 40;
        els.push({ ...baseEl("rectangle", bx, by, 160, 80), backgroundColor: "#dbe4ff", fillStyle: "solid", roughness: 0, strokeColor: "#4c6ef5" });
        els.push(textEl(bx + 20, by + 22, `Вариант ${i+1}`, 14));
        els.push(arrowEl(430, 230, bx + 80 - 430, by + 40 - 230));
      }
      return els;
    },
  },
  {
    id: "coordinate", label: "Координатная плоскость", icon: "📐",
    build: () => {
      const cx = 500, cy = 360;
      const els: object[] = [
        arrowEl(cx-300, cy, 600, 0),
        arrowEl(cx, cy+300, 0, -600),
        textEl(cx+306, cy-10, "x"),
        textEl(cx-14, cy-316, "y"),
      ];
      for (let n = -5; n <= 5; n++) {
        if (n === 0) continue;
        els.push(textEl(cx + n*50 - 8, cy + 8, String(n), 13));
        els.push(textEl(cx - 20, cy - n*50 - 8, String(n), 13));
      }
      return els;
    },
  },
  {
    id: "plan", label: "План урока", icon: "📝",
    build: () => [
      { ...baseEl("rectangle", 40, 40, 900, 600), roughness: 0, strokeWidth: 2 },
      textEl(60, 60, "Урок", 22),
      ...["1. Повторение", "2. Новая тема", "3. Практика", "4. ДЗ"].map((s, i) => ({
        ...baseEl("rectangle", 60+(i%2)*440, 100+Math.floor(i/2)*230, 400, 200),
        backgroundColor: "#dbe4ff", fillStyle: "solid", roughness: 0, strokeColor: "#4c6ef5",
      })),
      ...["1. Повторение", "2. Новая тема", "3. Практика", "4. ДЗ"].map((s, i) =>
        textEl(80+(i%2)*440, 180+Math.floor(i/2)*230, s, 16)
      ),
    ],
  },
];

// ── BoardPage ─────────────────────────────────────────────────────────────────
export default function BoardPage() {
  const params   = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const [, setLocation] = useLocation();
  const { theme } = useTheme();

  const apiRef     = useRef<any>(null);           // ExcalidrawImperativeAPI
  const wsRef      = useRef<WebSocket | null>(null);
  const debRef     = useRef<ReturnType<typeof setTimeout>>();
  const curDeb     = useRef<ReturnType<typeof setTimeout>>();
  const suppressRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status,       setStatus]       = useState<SyncStatus>("connecting");
  const [collaborators, setCollaborators] = useState<Map<string, any>>(new Map());
  const [showShapes,   setShowShapes]   = useState(false);
  const [showTemplates,setShowTemplates]= useState(false);
  const [showArchive,  setShowArchive]  = useState(false);
  const [showClearConf,setShowClearConf]= useState(false);
  const [showHelp,     setShowHelp]     = useState(false);
  const [showMore,     setShowMore]     = useState(false);
  const [archiveName,  setArchiveName]  = useState("");
  const [isArchiving,  setIsArchiving]  = useState(false);
  const [activeTool,   setActiveTool]   = useState<string>("selection");
  const [zoomPct,      setZoomPct]      = useState<number>(100);

  const { data: student } = useQuery<{ name: string; subject: string }>({
    queryKey: ["/api/students", studentId],
    queryFn: async () => {
      const r = await fetch(`/api/students/${studentId}`, { credentials: "include" });
      if (!r.ok) throw new Error("not found");
      return r.json();
    },
    enabled: !!studentId,
  });

  const { data: archives = [], refetch: refetchArchives } = useQuery<{ id: string; name: string; created_at: string }[]>({
    queryKey: ["/api/board-archives", studentId],
    queryFn: async () => {
      const r = await fetch(`/api/board-archives/${studentId}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!studentId,
  });

  const { data: allStudents = [] } = useQuery<{ id: string; name: string; status: string }[]>({
    queryKey: ["/api/students"],
    queryFn: async () => {
      const r = await fetch("/api/students", { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });

  const activeStudents = useMemo(() => allStudents.filter(s => s.status === "active"), [allStudents]);
  const currentIndex   = useMemo(() => activeStudents.findIndex(s => s.id === studentId), [activeStudents, studentId]);
  const prevStudent    = activeStudents[currentIndex - 1] ?? null;
  const nextStudent    = activeStudents[currentIndex + 1] ?? null;

  // WebSocket setup with token-based authentication
  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (destroyed) return;

      // Fetch a short-lived WS auth token from the server
      let token: string;
      try {
        const res = await fetch("/api/board/ws-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ studentId }),
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

      const wsUrl = `${proto}//${window.location.host}/ws/board?studentId=${studentId}&token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setStatus("connected");
      ws.onclose = () => {
        setStatus("disconnected");
        setCollaborators(new Map());
        if (!destroyed) reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => setStatus("disconnected");

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "snapshot" && msg.snapshot) {
            const elements = msg.snapshot?.document?.store
              ? extractFromTldrawSnapshot(msg.snapshot)
              : (msg.snapshot?.elements ?? msg.snapshot);
            if (Array.isArray(elements) && apiRef.current) {
              suppressRef.current = true;
              apiRef.current.updateScene({ elements });
              setTimeout(() => { suppressRef.current = false; }, 300);
            }
          } else if (msg.type === "cursor" && msg.x != null) {
            const id = "remote";
            setCollaborators(prev => {
              const next = new Map(prev);
              next.set(id, {
                pointer: { x: msg.x, y: msg.y, tool: "pointer" },
                button: "up",
                selectedElementIds: {},
                username: msg.name ?? "Ученик",
                color: { background: "#4f46e5", stroke: "#4338ca" },
                avatarUrl: undefined,
                id,
              });
              return next;
            });
          } else if (msg.type === "cursor_leave") {
            setCollaborators(new Map());
          }
        } catch {}
      };
    };

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      setCollaborators(new Map());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Update collaborator name when student data loads
  useEffect(() => {
    if (!student?.name) return;
  }, [student?.name]);

  const sendScene = useCallback(() => {
    const api = apiRef.current;
    if (!api || wsRef.current?.readyState !== WebSocket.OPEN) return;
    const elements = api.getSceneElements();
    wsRef.current.send(JSON.stringify({ type: "update", snapshot: { elements } }));
  }, []);

  const handleChange = useCallback((elements: readonly any[], appState?: any) => {
    if (appState?.activeTool?.type && appState.activeTool.type !== activeTool) {
      setActiveTool(appState.activeTool.type);
    }
    if (typeof appState?.zoom?.value === "number") {
      const pct = Math.round(appState.zoom.value * 100);
      if (pct !== zoomPct) setZoomPct(pct);
    }
    if (suppressRef.current) return;
    clearTimeout(debRef.current);
    debRef.current = setTimeout(sendScene, 600);
  }, [sendScene, activeTool, zoomPct]);

  const setTool = useCallback((type: string) => {
    apiRef.current?.setActiveTool?.({ type });
    setActiveTool(type);
  }, []);

  const adjustZoom = useCallback((delta: number, absolute?: number) => {
    const api: any = apiRef.current;
    if (!api) return;
    const cur = api.getAppState();
    const old = cur.zoom?.value ?? 1;
    const next = absolute !== undefined
      ? absolute
      : Math.min(30, Math.max(0.1, +(old + delta).toFixed(4)));
    if (Math.abs(next - old) < 1e-6) return;
    // Зум вокруг центра видимой области (как в Miro/Figma)
    const w = cur.width ?? window.innerWidth;
    const h = cur.height ?? window.innerHeight;
    const newScrollX = (cur.scrollX ?? 0) + (w / 2) * (1 / next - 1 / old);
    const newScrollY = (cur.scrollY ?? 0) + (h / 2) * (1 / next - 1 / old);
    api.updateScene({
      appState: { zoom: { value: next }, scrollX: newScrollX, scrollY: newScrollY },
    });
    setZoomPct(Math.round(next * 100));
  }, []);

  const dispatchExcalidrawKey = useCallback((key: string, opts: { shiftKey?: boolean } = {}) => {
    // Excalidraw 0.18 doesn't expose imperative undo/redo on the API.
    // It listens to keyboard events on its own canvas/container, so we dispatch a synthetic key.
    const root = document.querySelector(".tvoy-board-root");
    const target =
      (root?.querySelector(".excalidraw__canvas") as HTMLElement | null) ||
      (root?.querySelector(".excalidraw") as HTMLElement | null) ||
      (root as HTMLElement | null);
    if (!target) return;
    const init: KeyboardEventInit = {
      key,
      code: `Key${key.toUpperCase()}`,
      keyCode: key.toUpperCase().charCodeAt(0),
      which: key.toUpperCase().charCodeAt(0),
      ctrlKey: true,
      metaKey: true,
      shiftKey: !!opts.shiftKey,
      bubbles: true,
      cancelable: true,
    };
    target.dispatchEvent(new KeyboardEvent("keydown", init));
    target.dispatchEvent(new KeyboardEvent("keyup", init));
  }, []);

  const doUndo = useCallback(() => {
    dispatchExcalidrawKey("z");
  }, [dispatchExcalidrawKey]);

  const doRedo = useCallback(() => {
    // Both Ctrl+Y and Ctrl+Shift+Z trigger redo in Excalidraw — Shift+Z is more reliable cross-platform.
    dispatchExcalidrawKey("z", { shiftKey: true });
  }, [dispatchExcalidrawKey]);

  const handlePointerUpdate = useCallback((payload: { pointer: { x: number; y: number }; button: string }) => {
    clearTimeout(curDeb.current);
    curDeb.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "cursor",
          x: payload.pointer.x,
          y: payload.pointer.y,
          name: student?.name ?? "Репетитор",
        }));
      }
    }, 40);
  }, [student?.name]);

  const handleClearBoard = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    suppressRef.current = true;
    api.updateScene({ elements: [] });
    setTimeout(() => { suppressRef.current = false; }, 300);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "update", snapshot: { elements: [] } }));
    }
    setShowClearConf(false);
    toast.success("Доска очищена");
  }, []);

  const handleExportPNG = useCallback(async () => {
    const api = apiRef.current;
    if (!api) { toast.error("Доска не готова"); return; }
    const elements = api.getSceneElements().filter((el: any) => !el.isDeleted);
    if (!elements.length) { toast.error("Доска пустая"); return; }
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({ elements, appState: { exportBackground: true } as any, files: {} });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href = url;
      a.download = `доска-${student?.name ?? "урок"}-${new Date().toLocaleDateString("ru-RU").replace(/\./g, "-")}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PNG сохранён");
    } catch (e) { console.error(e); toast.error("Ошибка экспорта"); }
  }, [student]);

  const insertElements = useCallback((newEls: object[]) => {
    const api = apiRef.current;
    if (!api) return;
    const existing = api.getSceneElements();
    const combined = [...existing, ...newEls];
    api.updateScene({ elements: combined });
    sendScene();
  }, [sendScene]);

  const handleInsertGeo = useCallback((preset: GeoPreset) => {
    const api = apiRef.current;
    if (!api) return;
    const appState = api.getAppState();
    const cx = (appState.scrollX !== undefined ? -appState.scrollX + appState.width / 2 : 400);
    const cy = (appState.scrollY !== undefined ? -appState.scrollY + appState.height / 2 : 300);
    try {
      insertElements(preset.build(cx, cy));
      setShowShapes(false);
      toast.success("Фигура добавлена");
    } catch (e) { console.error(e); toast.error("Ошибка"); }
  }, [insertElements]);

  const handleApplyTemplate = useCallback((tpl: BoardTemplate) => {
    const api = apiRef.current;
    if (!api) return;
    suppressRef.current = true;
    api.updateScene({ elements: tpl.build() });
    setTimeout(() => {
      suppressRef.current = false;
      api.scrollToContent?.();
    }, 100);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "update", snapshot: { elements: tpl.build() } }));
    }
    setShowTemplates(false);
    toast.success(`Шаблон «${tpl.label}» применён`);
  }, []);

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src || !apiRef.current) return;
      const img = new Image();
      img.onload = () => {
        const el = {
          ...baseEl("image", 100, 100, Math.min(img.width, 600), Math.min(img.height, 400)),
          fileId: newId(),
          status: "saved",
          scale: [1, 1] as [number, number],
        };
        const files: Record<string, any> = {};
        files[el.fileId] = { id: el.fileId, dataURL: src, mimeType: file.type, created: Date.now() };
        apiRef.current.updateScene({ elements: [...apiRef.current.getSceneElements(), el] });
        apiRef.current.addFiles?.(Object.values(files));
        toast.success("Изображение добавлено");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleArchiveSave = useCallback(async () => {
    if (!studentId) return;
    setIsArchiving(true);
    const api = apiRef.current;
    try {
      const elements = api?.getSceneElements() ?? [];
      const name = archiveName.trim() || `Доска ${new Date().toLocaleDateString("ru-RU")}`;
      const snapshot = { elements };
      const r = await fetch(`/api/board-archives/${studentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, snapshot }),
      });
      if (!r.ok) { const e = await r.json(); toast.error(e.error || "Ошибка"); return; }
      await refetchArchives();
      setArchiveName("");
      toast.success("Доска сохранена в архив");
    } finally { setIsArchiving(false); }
  }, [studentId, archiveName, refetchArchives]);

  const handleRestoreArchive = useCallback(async (arcId: string) => {
    try {
      const r = await fetch(`/api/board-archives/${studentId}/${arcId}/snapshot`, { credentials: "include" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      const elements = data.snapshot?.elements ?? extractFromTldrawSnapshot(data.snapshot);
      if (!Array.isArray(elements) || !elements.length) {
        toast.error("Архив пуст или создан в старом формате"); return;
      }
      suppressRef.current = true;
      apiRef.current?.updateScene({ elements });
      setTimeout(() => { suppressRef.current = false; apiRef.current?.scrollToContent?.(); }, 200);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "update", snapshot: { elements } }));
      }
      setShowArchive(false);
      toast.success(`Доска «${data.name}» восстановлена`);
    } catch { toast.error("Не удалось восстановить архив"); }
  }, [studentId]);

  const handleDeleteArchive = useCallback(async (arcId: string, name: string) => {
    if (!confirm(`Удалить архив «${name}»?`)) return;
    try {
      await fetch(`/api/board-archives/${arcId}`, { method: "DELETE", credentials: "include" });
      await refetchArchives();
      toast.success("Архив удалён");
    } catch { toast.error("Ошибка"); }
  }, [refetchArchives]);

  // Cleanup
  useEffect(() => () => {
    clearTimeout(debRef.current);
    clearTimeout(curDeb.current);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col bg-background tvoy-board-root">

      {/* ── CSS: прячем нативный UI Excalidraw (только display, без pointer-events) ─ */}
      <style>{`
        .tvoy-board-root .App-menu_top,
        .tvoy-board-root .App-toolbar,
        .tvoy-board-root .App-toolbar-content,
        .tvoy-board-root .App-menu_bottom,
        .tvoy-board-root .App-bottom-bar,
        .tvoy-board-root .App-menu,
        .tvoy-board-root .layer-ui__wrapper__top-right,
        .tvoy-board-root .layer-ui__wrapper__footer-left,
        .tvoy-board-root .layer-ui__wrapper__footer-center,
        .tvoy-board-root .scroll-back-to-content,
        .tvoy-board-root .help-icon,
        .tvoy-board-root .undo-redo-buttons,
        .tvoy-board-root .zoom-actions,
        .tvoy-board-root .footer-center,
        .tvoy-board-root .mobile-misc-tools-container,
        .tvoy-board-root .welcome-screen-center,
        .tvoy-board-root .Stats { display: none !important; }
        .tvoy-board-root .excalidraw .Island { box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-radius: 14px; }
      `}</style>

      {/* ── Шапка (минимальная) ─────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background/80 backdrop-blur-xl z-50 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}
          className="h-9 w-9 rounded-xl shrink-0" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 min-w-0 mr-auto">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shrink-0">
            <span className="text-sm font-bold text-primary">{(student?.name ?? "Д").charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate leading-tight">{student?.name ?? "Доска"}</div>
            {student?.subject && <div className="text-[11px] text-muted-foreground truncate leading-tight">{student.subject}</div>}
          </div>
        </div>

        {/* Статус подключения — точка */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 shrink-0" title={
          status === "connected" ? "Синхронизировано" : status === "connecting" ? "Подключение..." : "Нет связи"
        }>
          <span className={cn(
            "h-2 w-2 rounded-full",
            status === "connected" && "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]",
            status === "connecting" && "bg-amber-400 animate-pulse",
            status === "disconnected" && "bg-destructive",
          )} />
          <span className="text-[11px] font-medium hidden md:inline text-muted-foreground">
            {status === "connected" ? "Онлайн" : status === "connecting" ? "Подключение" : "Офлайн"}
          </span>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />

        {/* Меню «Ещё» */}
        <div className="relative">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl"
            onClick={() => setShowMore(v => !v)} data-testid="button-more">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {showMore && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
              <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl border bg-popover shadow-xl p-1.5">
                <button onClick={() => { setShowTemplates(v => !v); setShowShapes(false); setShowArchive(false); setShowMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent text-sm" data-testid="menu-templates">
                  <LayoutTemplate className="h-4 w-4 text-muted-foreground" /> Шаблоны
                </button>
                <button onClick={() => { setShowShapes(v => !v); setShowTemplates(false); setShowArchive(false); setShowMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent text-sm" data-testid="menu-geometry">
                  <Triangle className="h-4 w-4 text-muted-foreground" /> Геометрия
                </button>
                <button onClick={() => { fileInputRef.current?.click(); setShowMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent text-sm" data-testid="menu-image">
                  <ImagePlus className="h-4 w-4 text-muted-foreground" /> Загрузить фото
                </button>
                <button onClick={() => { handleExportPNG(); setShowMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent text-sm" data-testid="menu-export">
                  <Download className="h-4 w-4 text-muted-foreground" /> Экспорт PNG
                </button>
                <button onClick={() => { setShowArchive(v => !v); setShowShapes(false); setShowTemplates(false); setShowMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent text-sm" data-testid="menu-archive">
                  <Archive className="h-4 w-4 text-muted-foreground" /> Архив досок
                </button>
                <button onClick={() => { setShowHelp(true); setShowMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-accent text-sm" data-testid="menu-help">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" /> Горячие клавиши
                </button>
                <div className="h-px bg-border my-1" />
                <button onClick={() => { setShowClearConf(true); setShowMore(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-destructive/10 text-sm text-destructive" data-testid="menu-clear">
                  <Trash2 className="h-4 w-4" /> Очистить доску
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Шаблоны: на мобильных горизонтальный скролл, на десктопе wrap ─ */}
      {showTemplates && (
        <div className="shrink-0 border-b bg-muted/20 z-40">
          <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto md:flex-wrap md:overflow-visible">
            <span className="text-xs font-medium text-muted-foreground mr-1 shrink-0">Шаблон:</span>
            {BOARD_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => handleApplyTemplate(t)}
                data-testid={`button-template-${t.id}`}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-background hover:bg-primary/10 hover:border-primary/40 transition-colors text-sm shadow-sm">
                <span className="text-base leading-none">{t.icon}</span>
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
            <span className="text-[10px] text-muted-foreground ml-auto hidden md:inline shrink-0">⚠ заменит текущую доску</span>
          </div>
        </div>
      )}

      {/* ── Геометрия: на мобильных горизонтальный скролл ───────── */}
      {showShapes && (
        <div className="shrink-0 border-b bg-muted/20 z-40">
          <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible">
            <span className="text-xs font-medium text-muted-foreground mr-1 shrink-0">Вставить:</span>
            {GEO_PRESETS.map(p => (
              <button key={p.type} onClick={() => handleInsertGeo(p)} title={p.label}
                data-testid={`button-geo-${p.type}`}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/60 bg-background hover:bg-primary/10 hover:border-primary/40 transition-colors">
                <span className="text-base leading-none">{p.icon}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Основная область ─────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Архив — на мобильных показывается как полноэкранный оверлей, на md+ как боковая панель */}
        {showArchive && (
          <>
            <div
              className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowArchive(false)}
            />
            <div
              className={cn(
                "bg-background flex flex-col overflow-hidden border-border/60",
                // mobile: полноэкранный слева bottom-sheet-style
                "fixed md:static inset-x-0 bottom-0 top-[56px] z-50 border-t rounded-t-2xl md:rounded-none",
                // desktop: боковая панель
                "md:w-64 md:shrink-0 md:border-r md:border-t-0 md:inset-auto md:top-auto md:z-30"
              )}
            >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-sm">Архив досок</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowArchive(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="px-4 py-3 border-b space-y-2">
              <p className="text-xs text-muted-foreground">Сохранить текущую доску:</p>
              <input className="w-full text-sm border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={`Доска ${new Date().toLocaleDateString("ru-RU")}`}
                value={archiveName} onChange={e => setArchiveName(e.target.value)}
                data-testid="input-archive-name" />
              <Button size="sm" className="w-full gap-1.5" onClick={handleArchiveSave}
                disabled={isArchiving} data-testid="button-archive-save">
                {isArchiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                Сохранить в архив
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {archives.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Архив пуст</p>
              ) : archives.map(arc => (
                <div key={arc.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="font-medium text-sm truncate">{arc.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(arc.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1"
                      onClick={() => handleRestoreArchive(arc.id)} data-testid={`button-restore-${arc.id}`}>
                      <RotateCcw className="h-3 w-3" /> Открыть
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:bg-red-50"
                      onClick={() => handleDeleteArchive(arc.id, arc.name)} data-testid={`button-delete-arc-${arc.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </>
        )}

        {/* Холст */}
        <div className="flex-1 relative min-w-0">
          <Excalidraw
            excalidrawAPI={(api: any) => { apiRef.current = api; }}
            onChange={handleChange}
            onPointerUpdate={handlePointerUpdate}
            theme={theme === "dark" ? "dark" : "light"}
            langCode="ru-RU"
            collaborators={collaborators as any}
            initialData={{ elements: [], appState: { viewBackgroundColor: theme === "dark" ? "#1a1a2e" : "#ffffff" } }}
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: false,
                clearCanvas: false,
                export: false,
                loadScene: false,
                saveAsImage: false,
                saveToActiveFile: false,
                toggleTheme: false,
              },
            } as any}
          />
        </div>
      </div>

      {/* ── Навигация по ученикам ─────────────────────────────── */}
      {activeStudents.length > 0 && (
        <div className="fixed bottom-14 left-4 z-50 flex items-center gap-1 bg-background/90 backdrop-blur border border-border/60 rounded-xl shadow-lg px-2 py-1.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!prevStudent}
            onClick={() => prevStudent && setLocation(`/board/${prevStudent.id}`)}
            data-testid="button-prev-student"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="flex flex-col items-center px-1">
            <span className="text-[11px] font-semibold truncate max-w-[120px]">{student?.name ?? "..."}</span>
            <span className="text-[10px] text-muted-foreground">
              {currentIndex >= 0 ? `${currentIndex + 1} / ${activeStudents.length}` : "—"}
            </span>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!nextStudent}
            onClick={() => nextStudent && setLocation(`/board/${nextStudent.id}`)}
            data-testid="button-next-student"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* ── Vertical Toolbar (Miro-style, left) — на мобильных компакт и скролл ─ */}
      <div className="fixed left-2 md:left-3 top-[66px] md:top-1/2 translate-y-0 md:-translate-y-1/2 z-40 max-h-[calc(100vh-140px)] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25)] p-1 md:p-1.5">
          {[
            { type: "selection", icon: MousePointer2, label: "Выделение (V)" },
            { type: "hand",      icon: Hand,          label: "Рука (H)" },
          ].map(t => (
            <button key={t.type} onClick={() => setTool(t.type)} title={t.label}
              data-testid={`tool-${t.type}`}
              className={cn(
                "h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-xl transition-all",
                activeTool === t.type ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-accent text-foreground/80"
              )}>
              <t.icon className="h-4 w-4" />
            </button>
          ))}

          <div className="h-px w-6 bg-border my-1" />

          {[
            { type: "freedraw", icon: Pencil,    label: "Карандаш (P)" },
            { type: "laser",    icon: Sparkles,  label: "Лазер (K)" },
            { type: "eraser",   icon: Eraser,    label: "Ластик (E)" },
            { type: "text",     icon: Type,      label: "Текст (T)" },
          ].map(t => (
            <button key={t.type} onClick={() => setTool(t.type)} title={t.label}
              data-testid={`tool-${t.type}`}
              className={cn(
                "h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-xl transition-all",
                activeTool === t.type ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-accent text-foreground/80"
              )}>
              <t.icon className="h-4 w-4" />
            </button>
          ))}

          <div className="h-px w-6 bg-border my-1" />

          {[
            { type: "rectangle", icon: Square,       label: "Прямоугольник (R)" },
            { type: "diamond",   icon: Diamond,      label: "Ромб (D)" },
            { type: "ellipse",   icon: Circle,       label: "Эллипс (O)" },
            { type: "arrow",     icon: ArrowUpRight, label: "Стрелка (A)" },
            { type: "line",      icon: Minus,        label: "Линия (L)" },
            { type: "frame",     icon: FrameIcon,    label: "Фрейм (F)" },
          ].map(t => (
            <button key={t.type} onClick={() => setTool(t.type)} title={t.label}
              data-testid={`tool-${t.type}`}
              className={cn(
                "h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-xl transition-all",
                activeTool === t.type ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-accent text-foreground/80"
              )}>
              <t.icon className="h-4 w-4" />
            </button>
          ))}

          <div className="h-px w-6 bg-border my-1" />

          <button onClick={() => fileInputRef.current?.click()} title="Загрузить фото" data-testid="tool-image"
            className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-xl hover:bg-accent text-foreground/80 transition-all">
            <ImagePlus className="h-4 w-4" />
          </button>
          <button onClick={() => { setShowShapes(v => !v); setShowTemplates(false); setShowArchive(false); }}
            title="Геометрия" data-testid="tool-geometry"
            className={cn(
              "h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-xl transition-all",
              showShapes ? "bg-secondary text-secondary-foreground" : "hover:bg-accent text-foreground/80"
            )}>
            <Triangle className="h-4 w-4" />
          </button>
          <button onClick={() => { setShowTemplates(v => !v); setShowShapes(false); setShowArchive(false); }}
            title="Шаблоны" data-testid="tool-templates"
            className={cn(
              "h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-xl transition-all",
              showTemplates ? "bg-secondary text-secondary-foreground" : "hover:bg-accent text-foreground/80"
            )}>
            <LayoutTemplate className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Undo/Redo/Delete (bottom-left, like BBB) ──────────── */}
      <div className="fixed bottom-5 left-3 z-50">
        <div className="flex items-center gap-0.5 rounded-2xl border border-border/60 bg-background/90 backdrop-blur-xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25)] p-1.5">
          <button onClick={doUndo} title="Отменить (Ctrl+Z)" data-testid="tool-undo"
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-accent text-foreground/80">
            <Undo2 className="h-4 w-4" />
          </button>
          <button onClick={doRedo} title="Повторить (Ctrl+Y)" data-testid="tool-redo"
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-accent text-foreground/80">
            <Redo2 className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-border mx-0.5" />
          <button onClick={() => setShowClearConf(true)} title="Очистить доску" data-testid="tool-clear"
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-destructive/10 text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Zoom controls (Concept-style, bottom-right) ────────── */}
      <div className="fixed bottom-5 right-5 z-50">
        <div className="flex items-center gap-0.5 rounded-2xl border border-border/60 bg-background/85 backdrop-blur-xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25)] p-1.5">
          <button onClick={() => adjustZoom(-0.1)} title="Уменьшить" data-testid="button-zoom-out"
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-accent text-foreground/80">
            <Minus className="h-4 w-4" />
          </button>
          <button onClick={() => adjustZoom(0, 1)} title="100%" data-testid="button-zoom-reset"
            className="h-9 min-w-[2.75rem] md:min-w-[3.5rem] px-1.5 md:px-2 flex items-center justify-center rounded-xl hover:bg-accent text-[11px] md:text-xs font-mono font-medium tabular-nums">
            {zoomPct}%
          </button>
          <button onClick={() => adjustZoom(0.1)} title="Увеличить" data-testid="button-zoom-in"
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-accent text-foreground/80">
            <Plus className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-border mx-0.5" />
          <button onClick={() => apiRef.current?.scrollToContent?.()} title="По размеру экрана" data-testid="button-fit-screen"
            className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-accent text-foreground/80">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Диалог очистки ───────────────────────────────────── */}
      {showClearConf && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <div className="font-semibold">Очистить доску?</div>
                <div className="text-sm text-muted-foreground">Все элементы будут удалены</div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowClearConf(false)}>Отмена</Button>
              <Button variant="destructive" className="flex-1" onClick={handleClearBoard}>Очистить</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Горячие клавиши ─────────────────────────────────── */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background rounded-2xl border shadow-2xl p-6 max-w-sm w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold">Горячие клавиши</div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHelp(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {[
                { keys: ["V"],           desc: "Выделение" },
                { keys: ["H"],           desc: "Рука (панорама)" },
                { keys: ["P"],           desc: "Карандаш" },
                { keys: ["K"],           desc: "Лазерная указка" },
                { keys: ["E"],           desc: "Ластик" },
                { keys: ["F"],           desc: "Фрейм" },
                { keys: ["R"],           desc: "Прямоугольник" },
                { keys: ["O"],           desc: "Эллипс" },
                { keys: ["D"],           desc: "Ромб" },
                { keys: ["A"],           desc: "Стрелка" },
                { keys: ["L"],           desc: "Линия" },
                { keys: ["T"],           desc: "Текст" },
                { keys: ["I"],           desc: "Изображение" },
                { keys: ["Ctrl","Z"],    desc: "Отменить" },
                { keys: ["Ctrl","Y"],    desc: "Повторить" },
                { keys: ["Ctrl","A"],    desc: "Выбрать всё" },
                { keys: ["Ctrl","G"],    desc: "Сгруппировать" },
                { keys: ["Del"],         desc: "Удалить" },
                { keys: ["Ctrl","+/-"],  desc: "Масштаб" },
                { keys: ["Ctrl","0"],    desc: "По размеру экрана" },
              ].map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{s.desc}</span>
                  <div className="flex gap-1 shrink-0">
                    {s.keys.map((k, j) => (
                      <kbd key={j} className="px-2 py-0.5 text-xs bg-muted rounded-md border border-border/60 font-mono">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compat: try to extract elements from old tldraw snapshot ──────────────────
function extractFromTldrawSnapshot(snapshot: any): any[] {
  if (!snapshot) return [];
  if (Array.isArray(snapshot.elements)) return snapshot.elements;
  return [];
}
