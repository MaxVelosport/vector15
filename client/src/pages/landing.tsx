import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import {
  BookOpen, Calendar, GraduationCap, BarChart3, MessageSquare,
  Video, Wallet, Sparkles, CheckCircle2, ArrowRight, Bot, Users,
  Shield, Zap, Target, Clock, TrendingUp, BellRing, X,
  ChevronRight, Star, Flame, Award, CreditCard, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trialDaysWord } from "@/lib/plural-ru";

import { useDocumentTitle } from "@/hooks/use-document-title";
/* ─── Trial period hook ─────────────────────────────────── */
// Returns null while loading so UI can avoid showing stale "30 days" copy
// if the real setting is 0 (prevents brief trial-messaging flicker).
function useTrialDays(): number | null {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/trial-days")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const n = data == null ? 30 : Number(data.days);
        setDays(Number.isInteger(n) && n >= 0 && n <= 365 ? n : 30);
      })
      .catch(() => { if (!cancelled) setDays(30); });
    return () => { cancelled = true; };
  }, []);
  return days;
}

/* ─── Animated counter ──────────────────────────────────── */
function Counter({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 20 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (inView) mv.set(to);
  }, [inView, mv, to]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return unsub;
  }, [spring]);

  return <span ref={ref}>{prefix}{display.toLocaleString("ru-RU")}{suffix}</span>;
}

/* ─── Floating card (hero decoration) ──────────────────── */
function FloatCard({ className, delay = 0, children }: { className?: string; delay?: number; children: React.ReactNode }) {
  return (
    <motion.div
      className={cn("absolute rounded-2xl bg-card/90 border border-border/60 backdrop-blur-sm shadow-xl px-3 py-2.5 text-xs font-medium", className)}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.6, type: "spring" }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Scroll-reveal wrapper ─────────────────────────────── */
function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Pain point item ───────────────────────────────────── */
const PAINS = [
  { icon: "📊", text: "Ведёте таблицы в Excel или Google Sheets" },
  { icon: "📱", text: "Переписываетесь с учениками в разных мессенджерах" },
  { icon: "📝", text: "Записываете оплаты в блокнот или телефон" },
  { icon: "🔔", text: "Забываете напомнить об уроке или задолженности" },
  { icon: "💸", text: "Не знаете точно — кто и сколько должен" },
  { icon: "⏰", text: "Тратите 5+ часов в неделю на рутину" },
];

/* ─── Feature cards ─────────────────────────────────────── */
const FEATURES = [
  { icon: Calendar, color: "text-blue-500", bg: "bg-blue-500/10", title: "Умное расписание", desc: "Создайте занятия на весь год в пару кликов. Система сама напомнит ученику о предстоящем уроке." },
  { icon: Wallet, color: "text-emerald-500", bg: "bg-emerald-500/10", title: "Финансы и оплаты", desc: "Баланс каждого ученика в реальном времени. Онлайн-оплата через ЮKassa — картой, МИР, СБП." },
  { icon: Video, color: "text-violet-500", bg: "bg-violet-500/10", title: "Видеоуроки", desc: "Встроенные конференции. Ученик заходит по одной ссылке — никаких установок и регистраций." },
  { icon: BookOpen, color: "text-orange-500", bg: "bg-orange-500/10", title: "Домашние задания", desc: "Задавайте, принимайте и оценивайте в одном месте. Ученик видит статус и может задать вопрос." },
  { icon: Bot, color: "text-pink-500", bg: "bg-pink-500/10", title: "AI-помощник", desc: "Генерирует план урока за 10 секунд. Придумывает задания, тесты и объяснения по теме." },
  { icon: MessageSquare, color: "text-cyan-500", bg: "bg-cyan-500/10", title: "Telegram-бот", desc: "Ученики получают расписание, д/з и напоминания в Telegram. Без приложения, без регистрации." },
  { icon: BarChart3, color: "text-amber-500", bg: "bg-amber-500/10", title: "Аналитика", desc: "Доход, загруженность, прогресс каждого ученика. Видите всю картину одним взглядом." },
  { icon: Target, color: "text-red-500", bg: "bg-red-500/10", title: "Интерактивная доска", desc: "Совместная онлайн-доска с историей. Объясняйте, рисуйте, сохраняйте — доступна после урока." },
];

/* ─── Stats ─────────────────────────────────────────────── */
const STATS_BASE = [
  { value: 5, suffix: "+ ч/нед", label: "экономит каждый репетитор" },
  { value: 100, suffix: "%", label: "автоматических напоминаний" },
  { value: 8, suffix: " мин", label: "на полную настройку аккаунта" },
];
function buildStats(trialDays: number | null) {
  if (trialDays && trialDays > 0) {
    return [...STATS_BASE, { value: trialDays, suffix: ` ${trialDaysWord(trialDays)}`, label: "бесплатный доступ" }];
  }
  // Trial disabled or loading: replace with a neutral fourth stat
  return [...STATS_BASE, { value: 24, suffix: "/7", label: "поддержка и автоматизация" }];
}

/* ─── Typing headline ───────────────────────────────────── */
const HEADLINES = [
  "расписание занятий",
  "учёт оплат",
  "домашние задания",
  "напоминания ученикам",
  "видеоуроки онлайн",
  "AI-план урока",
];

function TypingHeadline() {
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setShown(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % HEADLINES.length);
        setShown(true);
      }, 350);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {shown && (
        <motion.span
          key={idx}
          className="text-primary inline-block"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35 }}
        >
          {HEADLINES[idx]}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/* ─── Main component ────────────────────────────────────── */
export default function LandingPage() {
  useDocumentTitle("CRM для репетиторов");
  const [scrolled, setScrolled] = useState(false);
  const trialDays = useTrialDays();
  const hasTrial = trialDays != null && trialDays > 0;
  const trialBullets = hasTrial
    ? ["✓ Без карты", `✓ ${trialDays} ${trialDaysWord(trialDays!)} бесплатно`, "✓ Настройка за 8 минут", "✓ Отмена в любой момент"]
    : ["✓ Без карты", "✓ Настройка за 8 минут", "✓ Отмена в любой момент"];
  const stats = buildStats(trialDays);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── ШАПКА ─────────────────────────────────────────── */}
      <motion.header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled ? "bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm" : "bg-transparent"
        )}
        initial={{ y: -60 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-serif text-lg font-semibold tracking-tight">Твой Вектор</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/catalog">
              <Button variant="ghost" size="sm" data-testid="link-landing-catalog">Найти репетитора</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm" data-testid="link-landing-login">Войти</Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="gap-1.5" data-testid="link-landing-register">
                <Zap className="h-3.5 w-3.5" />
                Начать бесплатно
              </Button>
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {/* Background */}
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
        <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />
        <div className="pointer-events-none absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/15 blur-[120px]" />
        <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-72 w-72 rounded-full bg-violet-500/10 blur-[100px]" />

        <div className="relative mx-auto max-w-5xl px-4 py-20 w-full">
          <div className="text-center">
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm text-primary font-medium mb-8"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              CRM для репетиторов · Версия 3.6
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              Забудьте про Excel.<br />
              <span className="text-muted-foreground/50">Автоматизируйте</span>{" "}
              <TypingHeadline />
            </motion.h1>

            {/* Subheading */}
            <motion.p
              className="mx-auto max-w-2xl text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
            >
              Платформа, которая берёт рутину на себя — расписание, оплаты, напоминания, домашние задания.
              Вы занимаетесь главным: <strong className="text-foreground">преподаёте</strong>.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
            >
              <Link href="/register">
                <Button size="lg" className="gap-2 px-8 h-12 text-base shadow-lg shadow-primary/25" data-testid="button-hero-register">
                  Начать бесплатно
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="gap-2 px-8 h-12 text-base" data-testid="button-hero-login">
                  Уже есть аккаунт
                </Button>
              </Link>
            </motion.div>

            <motion.p
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {hasTrial
                ? `${trialDays} ${trialDaysWord(trialDays!)} бесплатно · Без привязки карты · Настройка за 8 минут`
                : `Без привязки карты · Настройка за 8 минут`}
            </motion.p>
          </div>

          {/* Floating cards (декоративные) */}
          <div className="relative mt-16 h-64 sm:h-80 hidden sm:block">
            {/* Central dashboard mockup */}
            <motion.div
              className="absolute left-1/2 top-0 -translate-x-1/2 w-full max-w-2xl rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-2xl overflow-hidden"
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Mock header */}
              <div className="flex items-center gap-2 border-b border-border/50 bg-muted/50 px-4 py-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-2 text-xs text-muted-foreground font-medium">tvoyvector.ru — Дашборд</span>
              </div>
              {/* Mock content */}
              <div className="p-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Учеников", value: "12", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", sub: "↑ 2 за месяц" },
                  { label: "Доход апрель", value: "84 000 ₽", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10", sub: "+14% к марту" },
                  { label: "Занятий сегодня", value: "4", icon: Calendar, color: "text-violet-500", bg: "bg-violet-500/10", sub: "След: в 14:00" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-muted/60 p-3">
                    <div className={cn("mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg", s.bg)}>
                      <s.icon className={cn("h-3.5 w-3.5", s.color)} />
                    </div>
                    <div className="text-base font-bold leading-none mb-0.5">{s.value}</div>
                    <div className="text-[10px] text-muted-foreground">{s.label}</div>
                    <div className="text-[10px] text-emerald-500 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>
              {/* Mock lesson list */}
              <div className="px-4 pb-4 space-y-1.5">
                {[
                  { name: "Маша Иванова", time: "14:00", subject: "Математика", paid: true },
                  { name: "Дима Петров", time: "16:00", subject: "Физика", paid: false },
                ].map((l) => (
                  <div key={l.name} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">{l.name[0]}</div>
                      <div>
                        <div className="text-xs font-medium">{l.name}</div>
                        <div className="text-[10px] text-muted-foreground">{l.time} · {l.subject}</div>
                      </div>
                    </div>
                    <span className={cn("text-[10px] rounded-full px-2 py-0.5 font-medium", l.paid ? "bg-emerald-500/15 text-emerald-600" : "bg-orange-500/15 text-orange-600")}>
                      {l.paid ? "✓ Оплачено" : "✗ Долг"}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Floating badges */}
            <FloatCard className="-left-4 top-8 lg:-left-20" delay={1.0}>
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-amber-500" />
                <div>
                  <div className="font-semibold text-xs">Напоминание отправлено</div>
                  <div className="text-muted-foreground text-[10px]">Маша Иванова → Telegram</div>
                </div>
              </div>
            </FloatCard>

            <FloatCard className="-right-4 top-4 lg:-right-20" delay={1.2}>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                <div>
                  <div className="font-semibold text-xs">Оплата получена</div>
                  <div className="text-muted-foreground text-[10px]">+3 600 ₽ · ЮKassa</div>
                </div>
              </div>
            </FloatCard>

            <FloatCard className="-right-4 bottom-12 lg:-right-16" delay={1.4}>
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-violet-500" />
                <div>
                  <div className="font-semibold text-xs">Д/з назначено</div>
                  <div className="text-muted-foreground text-[10px]">3 ученикам автоматически</div>
                </div>
              </div>
            </FloatCard>

            <FloatCard className="-left-4 bottom-8 lg:-left-16" delay={1.6}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-pink-500" />
                <div>
                  <div className="font-semibold text-xs">AI создал план урока</div>
                  <div className="text-muted-foreground text-[10px]">Геометрия · 9 класс · 45 мин</div>
                </div>
              </div>
            </FloatCard>
          </div>
        </div>
      </section>

      {/* ── БОЛЬ ──────────────────────────────────────────── */}
      <section className="py-20 bg-muted/30 border-y border-border/50">
        <div className="mx-auto max-w-5xl px-4">
          <Reveal className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-4 py-1.5 text-sm text-red-500 font-medium mb-4">
              <X className="h-3.5 w-3.5" />
              Узнаёте себя?
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Знакомо?
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Большинство репетиторов теряют часы каждую неделю на это
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PAINS.map((p, i) => (
              <Reveal key={p.text} delay={i * 0.07}>
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 group hover:border-red-500/30 transition-colors">
                  <span className="text-2xl shrink-0">{p.icon}</span>
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{p.text}</span>
                  <X className="ml-auto h-3.5 w-3.5 shrink-0 text-red-400/60" />
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.4} className="mt-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-primary/5 border border-primary/20 px-6 py-3 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Твой Вектор решает всё это — автоматически</span>
              <ChevronRight className="h-4 w-4 text-primary" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── ЦИФРЫ ─────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4">
          <Reveal className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Результаты с первой недели
            </h2>
            <p className="text-muted-foreground text-lg">Среднее по отзывам репетиторов, работающих с платформой</p>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.1}>
                <div className="rounded-2xl border border-border/60 bg-card p-6 text-center hover:border-primary/30 hover:shadow-md transition-all">
                  <div className="text-3xl sm:text-4xl font-bold text-primary mb-1">
                    <Counter to={s.value} suffix={s.suffix} />
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── ВОЗМОЖНОСТИ ───────────────────────────────────── */}
      <section className="py-20 bg-muted/20 border-y border-border/50">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="text-center mb-14">
            <Badge variant="outline" className="mb-4 gap-1.5 border-primary/30 bg-primary/5 text-primary">
              <Zap className="h-3 w-3" />
              Возможности
            </Badge>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Всё в одной платформе
            </h2>
            <p className="text-muted-foreground text-lg">Восемь инструментов, которые заменят пять разных сервисов</p>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06}>
                <div className="group rounded-2xl border border-border/60 bg-card p-5 h-full transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5">
                  <div className={cn("mb-3 flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110", f.bg)}>
                    <f.icon className={cn("h-5 w-5", f.color)} />
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── ДЛЯ КОГО + ЧТО ПОЛУЧАЮТ УЧЕНИКИ ─────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            {/* Для кого */}
            <Reveal>
              <div className="rounded-2xl border border-border/60 bg-card p-6 h-full">
                <div className="flex items-center gap-2 mb-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                    <Users className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">Для репетиторов</h3>
                </div>
                <div className="space-y-4">
                  {[
                    { icon: "🧑‍🏫", title: "Частные репетиторы", desc: "Ведёте занятия сами — наводите порядок в учениках, оплатах и расписании без Excel." },
                    { icon: "💼", title: "Самозанятые педагоги", desc: "История оплат, онлайн-приём денег, аналитика доходов — всё для спокойной отчётности." },
                    { icon: "💻", title: "Онлайн-преподаватели", desc: "Видеозвонки, доска, Telegram-бот — весь инструментарий для удалённых уроков." },
                  ].map((item) => (
                    <div key={item.title} className="flex gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                      <span className="text-xl shrink-0 mt-0.5">{item.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Ученики */}
            <Reveal delay={0.1}>
              <div className="rounded-2xl border border-border/60 bg-card p-6 h-full">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                      <Star className="h-4.5 w-4.5 text-emerald-500" />
                    </div>
                    <h3 className="font-semibold text-lg">Для учеников</h3>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20">
                    без регистрации
                  </Badge>
                </div>
                <div className="space-y-2.5 mb-5">
                  {[
                    "Личный кабинет по ссылке — без паролей",
                    "Расписание и ближайшие уроки",
                    "Домашние задания с проверкой",
                    "История оплат и текущий баланс",
                    "Кнопка входа в видеозвонок",
                    "Telegram-бот с напоминаниями и д/з",
                    "Интерактивная доска с историей",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Ученик получает персональную ссылку — открывает и сразу внутри.
                    <strong className="text-foreground"> Ничего устанавливать не нужно.</strong>
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── КАК ЭТО РАБОТАЕТ ──────────────────────────────── */}
      <section className="py-20 bg-muted/30 border-y border-border/50">
        <div className="mx-auto max-w-4xl px-4">
          <Reveal className="text-center mb-14">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Начать за 8 минут
            </h2>
            <p className="text-muted-foreground text-lg">Никаких настроек — просто открываете и работаете</p>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { step: "1", icon: Users, color: "bg-blue-500", title: "Добавьте ученика", desc: "Имя, предмет, стоимость урока. Система создаёт личный кабинет и Telegram-бот автоматически." },
              { step: "2", icon: Calendar, color: "bg-violet-500", title: "Запланируйте занятия", desc: "Выберите дни и время — создайте расписание на весь семестр в два клика. Напоминания сами." },
              { step: "3", icon: TrendingUp, color: "bg-emerald-500", title: "Получайте оплаты", desc: "Отправьте ученику ссылку на оплату — деньги придут на счёт, баланс обновится сам." },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 0.12}>
                <div className="relative rounded-2xl border border-border/60 bg-card p-6">
                  <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white text-xl font-bold", s.color)}>
                    {s.step}
                  </div>
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  {i < 2 && (
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 hidden sm:flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border z-10">
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── СРАВНЕНИЕ ─────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4">
          <Reveal className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              До и после
            </h2>
            <p className="text-muted-foreground text-lg">Как меняется жизнь репетитора с Твой Вектор</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* До */}
            <Reveal>
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/15">
                    <X className="h-4 w-4 text-red-500" />
                  </div>
                  <span className="font-semibold text-sm text-red-500">Без платформы</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    "Расписание в заметках телефона",
                    "Оплаты — в отдельной таблице",
                    "Напоминания вручную в WhatsApp",
                    "Долги считаете в уме",
                    "Д/з отправляете файлами",
                    "5-8 часов рутины в неделю",
                  ].map((t) => (
                    <div key={t} className="flex items-center gap-2">
                      <X className="h-3 w-3 shrink-0 text-red-400" />
                      <span className="text-sm text-muted-foreground">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
            {/* После */}
            <Reveal delay={0.1}>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <span className="font-semibold text-sm text-emerald-600">С Твой Вектор</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    "Расписание — автоматически, для всех",
                    "Баланс каждого ученика в реальном времени",
                    "Telegram-бот напоминает за вас",
                    "Долги — красным, всё видно сразу",
                    "Д/з в личном кабинете ученика",
                    "30 минут рутины в неделю",
                  ].map((t) => (
                    <div key={t} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                      <span className="text-sm text-muted-foreground">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── ДЕМО-ВИДЕО ─────────────────────────────────── */}
      <section className="py-20 bg-muted/20 border-y border-border/50">
        <div className="mx-auto max-w-4xl px-4">
          <Reveal className="text-center mb-10">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Посмотрите, как это работает
            </h2>
            <p className="text-muted-foreground text-lg">
              30 секунд — и вы всё поймёте
            </p>
          </Reveal>
          <Reveal>
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-border/60 bg-background shadow-2xl shadow-primary/10">
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"
                title="Демо Твой Вектор"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                data-testid="iframe-demo-video"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── ОТЗЫВЫ ─────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal className="text-center mb-12">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Что говорят репетиторы
            </h2>
            <p className="text-muted-foreground text-lg">
              Настоящие отзывы первых пользователей платформы
            </p>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                name: "Мария К.",
                role: "Репетитор по математике, 7 лет опыта",
                text: "Раньше вела 15 учеников в Excel и путалась в платежах. Теперь всё в одном месте — расписание, долги, домашки. Экономлю 2 часа в день.",
                initials: "МК",
                color: "from-violet-500 to-purple-500",
              },
              {
                name: "Дмитрий А.",
                role: "Репетитор по физике и математике",
                text: "AI-помощник реально пишет домашки по программе ученика. Видеоуроки встроенные, не надо дёргать Zoom. Ученики в восторге от личных кабинетов.",
                initials: "ДА",
                color: "from-blue-500 to-cyan-500",
              },
              {
                name: "Екатерина П.",
                role: "Преподаватель английского",
                text: "Автоматические напоминания об уроках в Telegram — родители перестали забывать. А встроенные платежи через ЮKassa закрыли вопрос с квитанциями.",
                initials: "ЕП",
                color: "from-pink-500 to-rose-500",
              },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="rounded-2xl border border-border/60 bg-card/50 p-6 h-full flex flex-col gap-4 hover:border-primary/40 transition-colors" data-testid={`testimonial-${i}`}>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed flex-1">
                    «{t.text}»
                  </p>
                  <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                    <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-semibold text-sm`}>
                      {t.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── ФИНАЛЬНЫЙ CTA ─────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-primary/10 blur-[100px]" />

        <Reveal className="relative mx-auto max-w-2xl px-4 text-center">
          <div className="flex justify-center gap-1 mb-5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
            ))}
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Пора перестать тратить<br />время на рутину
          </h2>
          <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
            Присоединяйтесь к репетиторам, которые уже работают умнее.
            {hasTrial
              ? ` Первые ${trialDays} ${trialDaysWord(trialDays!)} — бесплатно. Никаких ограничений.`
              : " Регистрация занимает меньше минуты."}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Link href="/register">
              <Button size="lg" className="gap-2 px-10 h-13 text-base shadow-lg shadow-primary/25" data-testid="button-cta-register">
                <Flame className="h-4 w-4" />
                Начать бесплатно
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            {trialBullets.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Award className="h-3.5 w-3.5" />
            <span>Вопросы?{" "}
              <a href="mailto:support@tvoyvector.ru" className="text-primary hover:underline">support@tvoyvector.ru</a>
            </span>
          </div>
        </Reveal>
      </section>

      {/* ── ФУТЕР ─────────────────────────────────────────── */}
      <footer className="border-t border-border/50 bg-muted/30 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
                <GraduationCap className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="font-serif font-semibold text-sm">Твой Вектор</span>
            </div>
            <div className="flex items-center gap-5 text-sm text-muted-foreground">
              <Link href="/legal/oferta" className="hover:text-foreground transition-colors" data-testid="link-footer-oferta">Публичная оферта</Link>
              <Link href="/legal/privacy" className="hover:text-foreground transition-colors" data-testid="link-footer-privacy">Конфиденциальность</Link>
              <a href="mailto:support@tvoyvector.ru" className="hover:text-foreground transition-colors">Поддержка</a>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              © 2025 Твой Вектор
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
