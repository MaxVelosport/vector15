import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Phone, CircleDollarSign, BookOpen, Award, Clock, ExternalLink, Share2, Star, MessageSquarePlus, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { SiVk, SiWhatsapp, SiInstagram, SiTelegram } from "react-icons/si";

interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
}

function StarRow({ value, size = "sm", interactive, onChange }: { value: number; size?: "sm" | "lg"; interactive?: boolean; onChange?: (v: number) => void }) {
  const cls = size === "lg" ? "h-7 w-7" : "h-4 w-4";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          disabled={!interactive}
          onClick={() => interactive && onChange?.(n)}
          className={interactive ? "transition-transform hover:scale-110" : "cursor-default"}
          data-testid={interactive ? `button-star-${n}` : undefined}
        >
          <Star
            className={`${cls} ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        </button>
      ))}
    </div>
  );
}

interface PublicTutor {
  name: string;
  subjects: string[];
  basePrice: number;
  bio: string | null;
  phone: string | null;
  telegram: string | null;
  experience: string | null;
  education: string | null;
  whatsapp: string | null;
  vk: string | null;
  instagram: string | null;
  achievements: string | null;
  videoUrl: string | null;
  subjectInfo: string | null;
  color: string;
  hidePrice: boolean;
  avatar: string | null;
}

const COLOR_MAP: Record<string, { gradient: string; badge: string; btn: string; ring: string }> = {
  violet: {
    gradient: "from-violet-600 via-purple-600 to-indigo-700",
    badge: "bg-violet-500/20 text-violet-100 border-violet-400/30",
    btn: "bg-violet-600 hover:bg-violet-700 text-white",
    ring: "ring-violet-400/40",
  },
  blue: {
    gradient: "from-blue-600 via-blue-700 to-indigo-700",
    badge: "bg-blue-500/20 text-blue-100 border-blue-400/30",
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
    ring: "ring-blue-400/40",
  },
  emerald: {
    gradient: "from-emerald-500 via-teal-600 to-cyan-700",
    badge: "bg-emerald-500/20 text-emerald-100 border-emerald-400/30",
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
    ring: "ring-emerald-400/40",
  },
  rose: {
    gradient: "from-rose-500 via-pink-600 to-fuchsia-700",
    badge: "bg-rose-500/20 text-rose-100 border-rose-400/30",
    btn: "bg-rose-600 hover:bg-rose-700 text-white",
    ring: "ring-rose-400/40",
  },
  amber: {
    gradient: "from-amber-500 via-orange-500 to-orange-600",
    badge: "bg-amber-500/20 text-amber-100 border-amber-400/30",
    btn: "bg-amber-600 hover:bg-amber-700 text-white",
    ring: "ring-amber-400/40",
  },
  slate: {
    gradient: "from-slate-700 via-slate-700 to-gray-800",
    badge: "bg-slate-500/20 text-slate-100 border-slate-400/30",
    btn: "bg-slate-700 hover:bg-slate-800 text-white",
    ring: "ring-slate-400/40",
  },
};

function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname.includes("youtube.com")) {
      videoId = u.searchParams.get("v");
    } else if (u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1);
    }
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    // ignore
  }
  return null;
}

function moneyRub(n: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);
}

export default function TutorPublic() {
  const [, params] = useRoute("/t/:slug");
  const [tutor, setTutor] = useState<PublicTutor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Reviews
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [trialMode, setTrialMode] = useState(false);
  const [applyName, setApplyName] = useState("");
  const [applyContact, setApplyContact] = useState("");
  const [applySubject, setApplySubject] = useState("");
  const [applyGrade, setApplyGrade] = useState("");
  const [applyGoal, setApplyGoal] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [authorContact, setAuthorContact] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = (slug: string) => {
    fetch(`/api/public/tutor/${slug}/reviews`)
      .then((r) => r.ok ? r.json() : { reviews: [], avgRating: 0, count: 0 })
      .then((d) => { setReviews(d.reviews || []); setAvgRating(d.avgRating || 0); setReviewCount(d.count || 0); })
      .catch(() => {});
  };

  useEffect(() => {
    if (!params?.slug) return;
    fetch(`/api/public/tutor/${params.slug}`)
      .then(res => {
        if (!res.ok) throw new Error("Профиль не найден");
        return res.json();
      })
      .then(data => { setTutor(data); setLoading(false); loadReviews(params.slug!); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [params?.slug]);

  const submitApplication = async () => {
    if (!params?.slug) return;
    if (applyName.trim().length < 2) {
      toast({ title: "Укажите имя", variant: "destructive" });
      return;
    }
    if (applyContact.trim().length < 3) {
      toast({ title: "Укажите контакт для связи", description: "Телефон, email или @telegram", variant: "destructive" });
      return;
    }
    setApplying(true);
    try {
      const res = await fetch(`/api/public/tutor/${params.slug}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: applyName.trim(),
          contact: applyContact.trim(),
          subject: applySubject.trim() || null,
          grade: applyGrade.trim() || null,
          goal: applyGoal.trim() || null,
          message: (trialMode ? "🎁 ЗАПРОС НА БЕСПЛАТНОЕ ПРОБНОЕ ЗАНЯТИЕ\n\n" : "") + (applyMessage.trim() || ""),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка отправки");
      setApplyDone(true);
      toast({ title: "Заявка отправлена!", description: "Репетитор скоро свяжется с вами." });
    } catch (e: any) {
      toast({ title: "Не удалось отправить", description: e.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const resetApplyForm = () => {
    setApplyName(""); setApplyContact(""); setApplySubject("");
    setApplyGrade(""); setApplyGoal(""); setApplyMessage("");
    setApplyDone(false);
  };

  const submitReview = async () => {
    if (!params?.slug) return;
    if (authorName.trim().length < 2) {
      toast({ title: "Укажите имя (минимум 2 символа)", variant: "destructive" });
      return;
    }
    if (reviewText.trim().length < 10) {
      toast({ title: "Отзыв слишком короткий", description: "Минимум 10 символов", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/tutor/${params.slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          authorContact: authorContact.trim() || null,
          rating,
          text: reviewText.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка отправки");
      toast({ title: "Спасибо!", description: json.message || "Отзыв появится после модерации." });
      setShowForm(false);
      setAuthorName(""); setAuthorContact(""); setRating(5); setReviewText("");
    } catch (e: any) {
      toast({ title: "Не удалось отправить", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <Spinner />
      </div>
    );
  }

  if (error || !tutor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <Card className="max-w-md">
          <CardContent className="p-10 text-center">
            <GraduationCap className="mx-auto h-14 w-14 text-muted-foreground/50" />
            <h1 className="mt-4 text-xl font-semibold">Профиль не найден</h1>
            <p className="mt-2 text-muted-foreground text-sm">
              Репетитор с таким адресом не найден или профиль скрыт.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const colors = COLOR_MAP[tutor.color] ?? COLOR_MAP.violet;
  const embedUrl = tutor.videoUrl ? getYoutubeEmbedUrl(tutor.videoUrl) : null;
  const hasContacts = tutor.phone || tutor.telegram || tutor.whatsapp || tutor.vk || tutor.instagram;

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: tutor.name, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const scrollToContacts = () => {
    document.getElementById("contacts-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToApply = () => {
    document.getElementById("apply-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">

      {/* ═══ HERO ═══ */}
      <div className={`bg-gradient-to-br ${colors.gradient} text-white`}>
        <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
          {/* Avatar */}
          <div className="flex flex-col items-center text-center">
            <div className={`relative mb-5 h-28 w-28 rounded-full ring-4 ${colors.ring} ring-offset-2 ring-offset-transparent overflow-hidden bg-white/20 flex items-center justify-center`}>
              {tutor.avatar ? (
                <img src={tutor.avatar} alt={tutor.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-white/95 select-none" data-testid="text-public-initials">
                  {tutor.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?"}
                </span>
              )}
            </div>

            {/* Name */}
            <h1 className="text-3xl font-bold md:text-4xl tracking-tight" data-testid="text-public-name">
              {tutor.name}
            </h1>

            {/* Subjects */}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {tutor.subjects.map((s, i) => (
                <span
                  key={i}
                  className={`rounded-full border px-3 py-0.5 text-sm font-medium ${colors.badge}`}
                  data-testid={`badge-subject-${i}`}
                >
                  {s}
                </span>
              ))}
            </div>

            {/* Experience + Education pills */}
            {(tutor.experience || tutor.education) && (
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {tutor.experience && (
                  <div className="flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-sm text-white/90" data-testid="text-public-experience">
                    <Clock className="h-3.5 w-3.5" />
                    Опыт: {tutor.experience}
                  </div>
                )}
                {tutor.education && (
                  <div className="flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-sm text-white/90" data-testid="text-public-education">
                    <GraduationCap className="h-3.5 w-3.5" />
                    {tutor.education}
                  </div>
                )}
              </div>
            )}

            {/* CTA buttons */}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => { resetApplyForm(); setTrialMode(true); setApplyOpen(true); }}
                className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition-all active:scale-95 hover:shadow-xl hover:shadow-amber-500/40 ring-2 ring-white/40"
                data-testid="button-trial-cta"
              >
                🎁 Бесплатное пробное
              </button>
              <button
                onClick={() => { resetApplyForm(); setTrialMode(false); setApplyOpen(true); }}
                className={`rounded-xl px-6 py-2.5 text-sm font-semibold shadow-lg transition-all active:scale-95 ${colors.btn}`}
                data-testid="button-apply-cta"
              >
                <Send className="inline h-4 w-4 mr-1.5 -mt-0.5" />
                Записаться на занятие
              </button>
              {hasContacts && (
                <button
                  onClick={scrollToContacts}
                  className="rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2.5 text-sm font-medium text-white transition-all active:scale-95"
                  data-testid="button-contact-cta"
                >
                  Контакты
                </button>
              )}
              <button
                onClick={handleShare}
                className="rounded-xl bg-white/15 hover:bg-white/25 px-4 py-2.5 text-sm font-medium text-white transition-all active:scale-95 flex items-center gap-1.5"
                data-testid="button-share"
              >
                <Share2 className="h-4 w-4" />
                {copied ? "Скопировано!" : "Поделиться"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        {/* Bio */}
        {tutor.bio && (
          <Card className="rounded-2xl border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="p-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <BookOpen className="h-4 w-4" /> О репетиторе
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-public-bio">
                {tutor.bio}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Subject info */}
        {tutor.subjectInfo && (
          <Card className="rounded-2xl border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="p-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <GraduationCap className="h-4 w-4" /> Предметы и подход
              </h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-public-subject-info">
                {tutor.subjectInfo}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Achievements */}
        {tutor.achievements && (
          <Card className="rounded-2xl border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="p-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Award className="h-4 w-4 text-amber-500" /> Достижения
              </h2>
              <ul className="space-y-2">
                {tutor.achievements.split("\n").filter(Boolean).map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" data-testid={`text-achievement-${i}`}>
                    <span className="mt-0.5 text-amber-500">✦</span>
                    {line}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Video */}
        {embedUrl && (
          <Card className="rounded-2xl border-border/60 bg-card/70 backdrop-blur overflow-hidden">
            <CardContent className="p-0">
              <div className="px-6 pt-5 pb-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  Видео-визитка
                </h2>
              </div>
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={embedUrl}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  data-testid="iframe-video"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Price */}
        {!tutor.hidePrice && (
          <Card className="rounded-2xl border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${colors.gradient} text-white`}>
                  <CircleDollarSign className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Стоимость занятия</div>
                  <div className="text-2xl font-bold" data-testid="text-public-price">
                    {moneyRub(tutor.basePrice)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contacts */}
        {hasContacts && (
          <Card className="rounded-2xl border-border/60 bg-card/70 backdrop-blur" id="contacts-section">
            <CardContent className="p-6">
              <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Контакты</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tutor.phone && (
                  <Button variant="outline" className="justify-start gap-3 h-11" asChild data-testid="button-public-phone">
                    <a href={`tel:${tutor.phone}`}>
                      <Phone className="h-4 w-4 text-slate-500" />
                      {tutor.phone}
                    </a>
                  </Button>
                )}
                {tutor.telegram && (
                  <Button variant="outline" className="justify-start gap-3 h-11" asChild data-testid="button-public-telegram">
                    <a href={`https://t.me/${tutor.telegram.replace("@", "")}`} target="_blank" rel="noopener noreferrer">
                      <SiTelegram className="h-4 w-4 text-blue-400" />
                      {tutor.telegram.startsWith("@") ? tutor.telegram : `@${tutor.telegram}`}
                    </a>
                  </Button>
                )}
                {tutor.whatsapp && (
                  <Button variant="outline" className="justify-start gap-3 h-11" asChild data-testid="button-public-whatsapp">
                    <a href={`https://wa.me/${tutor.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <SiWhatsapp className="h-4 w-4 text-green-500" />
                      WhatsApp
                    </a>
                  </Button>
                )}
                {tutor.vk && (
                  <Button variant="outline" className="justify-start gap-3 h-11" asChild data-testid="button-public-vk">
                    <a href={tutor.vk.startsWith("http") ? tutor.vk : `https://${tutor.vk}`} target="_blank" rel="noopener noreferrer">
                      <SiVk className="h-4 w-4 text-blue-600" />
                      ВКонтакте
                    </a>
                  </Button>
                )}
                {tutor.instagram && (
                  <Button variant="outline" className="justify-start gap-3 h-11" asChild data-testid="button-public-instagram">
                    <a href={`https://instagram.com/${tutor.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer">
                      <SiInstagram className="h-4 w-4 text-pink-500" />
                      {tutor.instagram.startsWith("@") ? tutor.instagram : `@${tutor.instagram}`}
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reviews */}
        <Card className="rounded-2xl border-border/60 bg-card/70 backdrop-blur" id="reviews-section">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Star className="h-4 w-4 text-amber-500" /> Отзывы учеников
              </h2>
              {reviewCount > 0 && (
                <div className="flex items-center gap-2 text-sm" data-testid="text-avg-rating">
                  <StarRow value={Math.round(avgRating)} />
                  <span className="font-semibold">{avgRating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({reviewCount})</span>
                </div>
              )}
            </div>

            {reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                Пока нет отзывов. Станьте первым!
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border/50 bg-background/50 p-4" data-testid={`review-${r.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm" data-testid={`text-review-author-${r.id}`}>{r.authorName}</div>
                      <StarRow value={r.rating} />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90" data-testid={`text-review-body-${r.id}`}>
                      {r.text}
                    </p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showForm ? (
              <Button
                onClick={() => setShowForm(true)}
                variant="outline"
                className="mt-4 w-full"
                data-testid="button-leave-review"
              >
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Оставить отзыв
              </Button>
            ) : (
              <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
                <div>
                  <Label className="text-xs">Ваше имя *</Label>
                  <Input
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Анна П."
                    maxLength={80}
                    data-testid="input-review-name"
                  />
                </div>
                <div>
                  <Label className="text-xs">Контакт (по желанию)</Label>
                  <Input
                    value={authorContact}
                    onChange={(e) => setAuthorContact(e.target.value)}
                    placeholder="email или телефон — не публикуется"
                    maxLength={120}
                    data-testid="input-review-contact"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Оценка</Label>
                  <StarRow value={rating} interactive size="lg" onChange={setRating} />
                </div>
                <div>
                  <Label className="text-xs">Отзыв *</Label>
                  <Textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Чем помог репетитор, что понравилось..."
                    rows={4}
                    maxLength={2000}
                    data-testid="textarea-review-text"
                  />
                  <div className="mt-1 text-xs text-muted-foreground text-right">{reviewText.length}/2000</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={submitReview}
                    disabled={submitting}
                    className="flex-1"
                    data-testid="button-submit-review"
                  >
                    {submitting ? "Отправка..." : "Отправить"}
                  </Button>
                  <Button
                    onClick={() => setShowForm(false)}
                    variant="ghost"
                    disabled={submitting}
                    data-testid="button-cancel-review"
                  >
                    Отмена
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Отзыв появится после проверки репетитором.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="py-4 text-center text-xs text-muted-foreground/70">
          Создано на платформе{" "}
          <a href="/" className="font-semibold text-muted-foreground hover:text-foreground transition-colors">
            Твой Вектор
          </a>
        </div>
      </div>

      {/* Apply dialog */}
      <Dialog open={applyOpen} onOpenChange={(v) => { setApplyOpen(v); if (!v) resetApplyForm(); }}>
        <DialogContent className="max-w-md" data-testid="dialog-apply">
          <DialogHeader>
            <DialogTitle>{trialMode ? "🎁 Бесплатное пробное занятие" : "Записаться на занятия"}</DialogTitle>
            <DialogDescription>
              {trialMode
                ? `${tutor.name} проведёт первое занятие бесплатно — чтобы вы познакомились и выбрали удобный график.`
                : `Заполните заявку — ${tutor.name} получит уведомление и свяжется с вами.`}
            </DialogDescription>
          </DialogHeader>
          {applyDone ? (
            <div className="py-6 text-center space-y-3">
              <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${colors.gradient} text-white`}>
                <Send className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Заявка отправлена!</h3>
              <p className="text-sm text-muted-foreground">
                {tutor.name.split(" ")[0]} получит уведомление и свяжется с вами по указанному контакту.
              </p>
              <Button onClick={() => setApplyOpen(false)} className="mt-2" data-testid="button-apply-close">
                Закрыть
              </Button>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div>
                <Label htmlFor="apply-name">Ваше имя *</Label>
                <Input
                  id="apply-name"
                  value={applyName}
                  onChange={(e) => setApplyName(e.target.value)}
                  placeholder="Иван Петров"
                  disabled={applying}
                  data-testid="input-apply-name"
                />
              </div>
              <div>
                <Label htmlFor="apply-contact">Как с вами связаться? *</Label>
                <Input
                  id="apply-contact"
                  value={applyContact}
                  onChange={(e) => setApplyContact(e.target.value)}
                  placeholder="Телефон, email или @telegram"
                  disabled={applying}
                  data-testid="input-apply-contact"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="apply-subject">Предмет</Label>
                  <Input
                    id="apply-subject"
                    value={applySubject}
                    onChange={(e) => setApplySubject(e.target.value)}
                    placeholder={tutor.subjects[0] || "Математика"}
                    disabled={applying}
                    data-testid="input-apply-subject"
                  />
                </div>
                <div>
                  <Label htmlFor="apply-grade">Класс</Label>
                  <Input
                    id="apply-grade"
                    value={applyGrade}
                    onChange={(e) => setApplyGrade(e.target.value)}
                    placeholder="9 класс"
                    disabled={applying}
                    data-testid="input-apply-grade"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="apply-goal">Цель (опционально)</Label>
                <Input
                  id="apply-goal"
                  value={applyGoal}
                  onChange={(e) => setApplyGoal(e.target.value)}
                  placeholder="ОГЭ, ЕГЭ, подтянуть оценки..."
                  disabled={applying}
                  data-testid="input-apply-goal"
                />
              </div>
              <div>
                <Label htmlFor="apply-message">Сообщение (опционально)</Label>
                <Textarea
                  id="apply-message"
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  placeholder="Расскажите о себе, какой график удобен..."
                  rows={3}
                  disabled={applying}
                  data-testid="input-apply-message"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setApplyOpen(false)}
                  disabled={applying}
                  data-testid="button-apply-cancel"
                >
                  Отмена
                </Button>
                <Button
                  onClick={submitApplication}
                  disabled={applying}
                  className={colors.btn}
                  data-testid="button-apply-submit"
                >
                  {applying ? "Отправка..." : "Отправить заявку"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
