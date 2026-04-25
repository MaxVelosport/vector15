import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Video,
  VideoOff,
  ExternalLink,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Loader2,
  Info,
  PhoneCall,
  Radio,
  ImagePlus,
} from "lucide-react";
import { SiZoom, SiGooglemeet, SiJitsi } from "react-icons/si";
import { parseConferenceLink, getJitsiEmbedUrl, type ConferenceService } from "@/lib/conference-utils";
import { cn } from "@/lib/utils";

function ServiceIcon({ service, className }: { service: ConferenceService; className?: string }) {
  if (service === 'zoom')        return <SiZoom className={cn("text-blue-600", className)} />;
  if (service === 'google_meet') return <SiGooglemeet className={cn("text-green-600", className)} />;
  if (service === 'teams')       return <Video className={cn("text-indigo-600", className)} />;
  return <Video className={cn("text-primary", className)} />;
}

interface StudentMe {
  id: string;
  name: string;
  links?: { conference?: string; board?: string };
  status?: string;
  student?: StudentMe;
}

export default function StudentConference() {
  const [, setLocation] = useLocation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [joiningBbb, setJoiningBbb] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: authData, isLoading } = useQuery<StudentMe>({
    queryKey: ["student-auth"],
    queryFn: async () => {
      const res = await fetch("/api/student/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка авторизации");
      return res.json();
    },
  });
  const student = authData?.student || authData;

  const { data: bbbConf } = useQuery<{ hasConference: boolean; title?: string; joinUrl?: string }>({
    queryKey: ["/api/student/bbb/conference"],
    queryFn: async () => {
      const res = await fetch("/api/student/bbb/conference", { credentials: "include" });
      if (!res.ok) return { hasConference: false };
      return res.json();
    },
    enabled: !!student,
  });

  const conferenceLink = student?.links?.conference;
  const confInfo = parseConferenceLink(conferenceLink);
  const displayName = student?.name || "Ученик";
  const embedUrl = confInfo?.isInternal && confInfo.roomName
    ? getJitsiEmbedUrl(confInfo.roomName, displayName)
    : confInfo?.url;

  const handleJoinBbb = () => {
    if (!bbbConf?.joinUrl) return;
    setJoiningBbb(true);
    window.open(bbbConf.joinUrl, "_blank");
    setTimeout(() => setJoiningBbb(false), 3000);
  };

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (!conferenceLink || !confInfo) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Конференция</h1>
          <p className="text-muted-foreground mt-1">Видеозанятие с репетитором</p>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-blue-500/5 border border-blue-500/10 px-4 py-2.5">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Здесь будет ссылка для входа в видеоконференцию с репетитором.
          </p>
        </div>

        {bbbConf?.hasConference && bbbConf.joinUrl ? (
          <Card className="rounded-2xl border-primary/20 bg-primary/5">
            <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
                <Radio className="h-8 w-8 text-primary" />
              </div>
              <div>
                <Badge className="mb-2 bg-primary/10 text-primary border-primary/20">BigBlueButton</Badge>
                <h3 className="font-semibold text-lg">{bbbConf.title || "Конференция готова"}</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Репетитор создал для вас конференцию. Нажмите кнопку ниже чтобы войти.
                </p>
              </div>
              <Button size="lg" className="gap-2 px-8" onClick={handleJoinBbb} disabled={joiningBbb} data-testid="button-join-bbb">
                {joiningBbb ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneCall className="h-5 w-5" />}
                Войти в конференцию
                {!joiningBbb && <ExternalLink className="h-4 w-4 opacity-60" />}
              </Button>
              <p className="text-xs text-muted-foreground">Откроется в новой вкладке</p>
              <div className="flex items-start gap-2 rounded-lg bg-blue-500/8 border border-blue-500/15 px-3 py-2.5 text-left max-w-sm">
                <ImagePlus className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Вставка изображений в доску:</span> репетитор всегда является главным (презентером). Чтобы вы тоже могли — попросите репетитора передать вам роль в BBB: нажать на ваше имя → «Сделать презентером».
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-10 flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <VideoOff className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Конференция не настроена</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Репетитор ещё не добавил ссылку для видеозвонков.
                  <br />
                  Обратитесь к нему, чтобы получить доступ.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (confInfo.isInternal && embedUrl) {
    return (
      <div ref={containerRef} className="fixed inset-0 bg-black flex flex-col z-50">
        <div className={cn(
          "flex items-center justify-between px-4 h-12 shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-sm transition-opacity",
          isFullscreen && "opacity-0 hover:opacity-100 absolute top-0 left-0 right-0 z-10"
        )}>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-white/80 hover:text-white hover:bg-white/10 h-8"
              onClick={() => setLocation("/student")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Выйти</span>
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
                <Video className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-white">Конференция с репетитором</span>
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] hidden sm:flex">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1 animate-pulse" />
              В эфире
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            onClick={handleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 relative">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black z-10">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Video className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <p className="text-white/80 font-medium">Подключение к конференции...</p>
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
          )}
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
            onLoad={() => setIframeLoaded(true)}
            title="Конференция"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Конференция</h1>
        <p className="text-muted-foreground mt-1">Видеозанятие с репетитором</p>
      </div>

      <div className={cn("rounded-2xl border p-6 flex flex-col items-center gap-5 text-center", confInfo.bgColor)}>
        <div className={cn("flex h-20 w-20 items-center justify-center rounded-full", confInfo.bgColor)}>
          <ServiceIcon service={confInfo.service} className="h-10 w-10" />
        </div>
        <div>
          <Badge className={cn("mb-2 text-xs", confInfo.bgColor, confInfo.color)}>
            {confInfo.displayName}
          </Badge>
          <h3 className="font-semibold text-lg">Готово к подключению</h3>
          <p className="text-muted-foreground text-sm mt-1">
            Ваш репетитор настроил конференцию через {confInfo.displayName}.
            <br />
            Нажмите кнопку ниже, чтобы войти.
          </p>
        </div>
        <a href={confInfo.url} target="_blank" rel="noopener noreferrer">
          <Button size="lg" className="gap-2 px-8">
            <PhoneCall className="h-5 w-5" />
            Войти в конференцию
            <ExternalLink className="h-4 w-4 opacity-60" />
          </Button>
        </a>
        <p className="text-xs text-muted-foreground">
          Откроется в новой вкладке
        </p>
      </div>

      <Card className="rounded-xl border-border/50">
        <CardContent className="p-4">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Советы для занятия</p>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>Проверьте камеру и микрофон перед началом</li>
            <li>Выберите тихое место без посторонних звуков</li>
            <li>Подготовьте тетрадь и ручку</li>
            <li>Войдите на 2–3 минуты раньше</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
