import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  ExternalLink,
  Users,
  Loader2,
  WifiOff,
  Copy,
  Check,
} from "lucide-react";
import { parseConferenceLink, getJitsiEmbedUrl } from "@/lib/conference-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ConferencePage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const studentId = params.get("studentId");
  const roomNameParam = params.get("room");

  const { user } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: students = [] } = useQuery<any[]>({
    queryKey: ["/api/students"],
  });

  const student = studentId ? students.find((s: any) => s.id === studentId) : null;

  const conferenceLink: string | undefined =
    student?.links?.conference ||
    (roomNameParam ? `jitsi:${roomNameParam}` : undefined);

  const confInfo = parseConferenceLink(conferenceLink);
  const roomName = confInfo?.roomName || roomNameParam || "";
  const displayName = user?.name || "Репетитор";
  const embedUrl = confInfo?.isInternal && roomName
    ? getJitsiEmbedUrl(roomName, displayName)
    : confInfo?.url;

  const handleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const copyLink = () => {
    if (!embedUrl) return;
    navigator.clipboard.writeText(embedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Ссылка скопирована");
    });
  };

  if (!conferenceLink && !roomNameParam) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 p-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
          <VideoOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Конференция не настроена</h2>
          <p className="text-muted-foreground mt-1 text-sm">Добавьте ссылку на конференцию в профиле ученика</p>
        </div>
        <Button onClick={() => setLocation("/students")} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          К ученикам
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black flex flex-col">
      <div className={cn(
        "flex items-center justify-between px-4 h-12 shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-sm transition-opacity",
        isFullscreen && "opacity-0 hover:opacity-100 absolute top-0 left-0 right-0 z-10"
      )}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-white/80 hover:text-white hover:bg-white/10 h-8"
            onClick={() => setLocation(studentId ? `/students` : "/")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Назад</span>
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
              <Video className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-medium text-white">
                {student?.name ? `Конференция — ${student.name}` : "Конференция"}
              </span>
              {roomName && (
                <span className="ml-2 text-[10px] text-white/50 font-mono hidden sm:inline">{roomName}</span>
              )}
            </div>
          </div>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] hidden sm:flex">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1 animate-pulse" />
            В эфире
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {embedUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-white/70 hover:text-white hover:bg-white/10 h-8"
              onClick={copyLink}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline text-xs">{copied ? "Скопировано" : "Ссылка"}</span>
            </Button>
          )}
          {embedUrl && (
            <a href={embedUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5 text-white/70 hover:text-white hover:bg-white/10 h-8">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">Открыть</span>
              </Button>
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            onClick={handleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 relative">
        {!iframeLoaded && embedUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black z-10">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Video className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white/80 font-medium">Подключение...</p>
              <p className="text-white/40 text-sm mt-0.5">Jitsi Meet</p>
            </div>
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        )}

        {embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
            onLoad={() => setIframeLoaded(true)}
            title="Конференция"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <WifiOff className="h-12 w-12 text-white/30" />
            <div className="text-center">
              <p className="text-white/70 font-medium">Нет ссылки на конференцию</p>
              <p className="text-white/40 text-sm mt-1">Настройте внутреннюю конференцию в профиле ученика</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
