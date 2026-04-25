import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  onTranscript: (text: string) => void;
  /** Visual size — matches shadcn Button size prop. */
  size?: "default" | "sm" | "icon";
  /** Disable when host input is disabled / loading. */
  disabled?: boolean;
  /** Optional ISO 639-1 code; defaults to "ru". */
  lang?: string;
  /** Optional aria-label override. */
  ariaLabel?: string;
  /** Extra classes for the button. */
  className?: string;
  /** Test id. */
  "data-testid"?: string;
};

/**
 * Reusable microphone button that records browser audio,
 * sends it to /api/voice/transcribe, and pipes the recognised text
 * back via onTranscript().
 *
 * UX:
 *  - Idle:       grey mic icon, click → start recording
 *  - Recording:  red square, pulses; click → stop & transcribe
 *  - Loading:    spinner (request in flight)
 */
export function VoiceInputButton({
  onTranscript,
  size = "icon",
  disabled = false,
  lang = "ru",
  ariaLabel,
  className,
  ...rest
}: Props) {
  const [state, setState] = useState<"idle" | "recording" | "loading">("idle");
  const [supported, setSupported] = useState(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok =
      !!navigator?.mediaDevices?.getUserMedia &&
      typeof window.MediaRecorder !== "undefined";
    setSupported(ok);
  }, []);

  useEffect(() => () => cleanupStream(), []);

  function cleanupStream() {
    try {
      recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    } catch {}
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
  }

  function pickMimeType(): string {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/mpeg",
    ];
    for (const c of candidates) {
      try { if (MediaRecorder.isTypeSupported(c)) return c; } catch {}
    }
    return "";
  }

  async function startRecording() {
    if (!supported) {
      toast({
        title: "Голосовой ввод недоступен",
        description: "Ваш браузер не поддерживает запись звука. Используйте Chrome, Safari или Firefox.",
        variant: "destructive",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => void handleStopAndTranscribe(mr.mimeType || mimeType || "audio/webm");
      mr.start();
      recorderRef.current = mr;
      setState("recording");
    } catch (e: any) {
      cleanupStream();
      setState("idle");
      const msg = e?.name === "NotAllowedError"
        ? "Разрешите доступ к микрофону в настройках браузера."
        : (e?.message || "Не удалось получить доступ к микрофону.");
      toast({ title: "Микрофон недоступен", description: msg, variant: "destructive" });
    }
  }

  function stopRecording() {
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        setState("loading");
        recorderRef.current.stop();
      }
    } catch {
      cleanupStream();
      setState("idle");
    }
  }

  async function handleStopAndTranscribe(mime: string) {
    const tracks = streamRef.current?.getTracks() || [];
    tracks.forEach((t) => t.stop());
    streamRef.current = null;

    const blob = new Blob(chunksRef.current, { type: mime });
    chunksRef.current = [];
    recorderRef.current = null;

    if (!blob.size) {
      setState("idle");
      return;
    }
    // Reject very short clicks (< 0.3s of webm = ~3KB of opus)
    if (blob.size < 1500) {
      setState("idle");
      toast({
        title: "Запись слишком короткая",
        description: "Зажмите кнопку и говорите хотя бы секунду.",
      });
      return;
    }

    try {
      const ext = mime.includes("mp4") ? "m4a"
        : mime.includes("ogg") ? "ogg"
        : mime.includes("mpeg") || mime.includes("mp3") ? "mp3"
        : "webm";
      const fd = new FormData();
      fd.append("audio", new File([blob], `voice.${ext}`, { type: mime }));
      fd.append("lang", lang);
      const r = await fetch("/api/voice/transcribe", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${r.status}`);
      }
      const { text } = await r.json();
      const t = (text || "").trim();
      if (!t) {
        toast({ title: "Не удалось распознать", description: "Попробуйте говорить громче и чётче." });
      } else {
        onTranscript(t);
      }
    } catch (e: any) {
      toast({
        title: "Ошибка распознавания",
        description: e?.message || "Попробуйте ещё раз.",
        variant: "destructive",
      });
    } finally {
      setState("idle");
    }
  }

  const isRecording = state === "recording";
  const isLoading = state === "loading";

  return (
    <Button
      type="button"
      variant={isRecording ? "destructive" : "ghost"}
      size={size}
      disabled={disabled || isLoading}
      onClick={isRecording ? stopRecording : startRecording}
      className={cn(
        isRecording && "animate-pulse",
        className,
      )}
      aria-label={ariaLabel || (isRecording ? "Остановить запись" : "Голосовой ввод")}
      title={isRecording ? "Остановить запись" : "Голосовой ввод"}
      data-testid={rest["data-testid"] || "button-voice-input"}
    >
      {isLoading ? <Loader2 className="animate-spin" />
        : isRecording ? <Square />
        : <Mic />}
    </Button>
  );
}

export default VoiceInputButton;
