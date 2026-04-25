import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Mail, Lock, GraduationCap, Users, Sparkles,
  Eye, EyeOff, CheckCircle2, Calendar, TrendingUp, CircleDollarSign,
  MessageCircle, Bot, FlaskConical, Trophy, Flame, BookOpen,
  BarChart3, FileText, Video, Zap, Star, Target, Wallet, PenLine,
  BrainCircuit, ShieldCheck, Clock, ChevronRight,
  BadgeCheck, ClipboardList, AlertCircle, Play, Medal,
} from "lucide-react";

import { useDocumentTitle } from "@/hooks/use-document-title";
// ── Brand logo ─────────────────────────────────────────────────────────────
function BrandLogo({ size = "lg" }: { size?: "sm" | "lg" }) {
  const tc = size === "lg" ? "text-3xl" : "text-xl";
  const sc = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-1.5 select-none">
      <span className={`${tc} font-extrabold tracking-tight bg-gradient-to-r from-blue-200 via-cyan-100 to-blue-200 bg-clip-text text-transparent`}>ТВОЙ</span>
      <svg viewBox="0 0 24 24" className={`${sc} text-cyan-300`} fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M7 17L17 7M17 7H9M17 7V15" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className={`${tc} font-extrabold tracking-tight bg-gradient-to-r from-cyan-100 via-blue-200 to-cyan-100 bg-clip-text text-transparent`}>ВЕКТОР</span>
    </div>
  );
}
function BrandLogoLight({ size = "sm" }: { size?: "sm" | "lg" }) {
  const tc = size === "lg" ? "text-3xl" : "text-xl";
  const sc = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-1.5 select-none">
      <span className={`${tc} font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-clip-text text-transparent`}>ТВОЙ</span>
      <svg viewBox="0 0 24 24" className={`${sc} text-blue-500`} fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M7 17L17 7M17 7H9M17 7V15" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className={`${tc} font-extrabold tracking-tight bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 bg-clip-text text-transparent`}>ВЕКТОР</span>
    </div>
  );
}

// ── Shared feature tab bar ─────────────────────────────────────────────────
function FeatureTabBar({ tabs, active, onSelect, accent }: {
  tabs: { id: string; icon: any; label: string }[];
  active: string; onSelect: (id: string) => void;
  accent: "cyan" | "violet";
}) {
  const activeClass = accent === "cyan"
    ? "bg-cyan-500/25 border-cyan-400/40 text-cyan-300"
    : "bg-violet-500/25 border-violet-400/40 text-violet-300";
  return (
    <div className="flex gap-1.5 overflow-x-auto shrink-0" style={{ scrollbarWidth: "none" }}>
      {tabs.map((tab, i) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <motion.button
            key={tab.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.05, type: "spring", stiffness: 300, damping: 24 }}
            onClick={() => onSelect(tab.id)}
            whileHover={{ scale: 1.06, y: -2 }}
            whileTap={{ scale: 0.93 }}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap border shrink-0 transition-colors duration-150 cursor-pointer",
              isActive ? activeClass : "border-white/10 text-white/35 hover:text-white/65 hover:border-white/20 bg-white/4"
            )}
          >
            <Icon className="h-3 w-3" />
            {tab.label}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── TUTOR FEATURE SCREENS ──────────────────────────────────────────────────

// Shared student data across all tutor screens
const T_STUDENTS = [
  { name: "Анна С.",    full: "Анна Соколова",  subj: "Математика", grade: "10", pct: 84, paid: true,  hw: 2, av: "А", clr: "#06b6d4", next: "сег. 15:00" },
  { name: "Дмитрий К.", full: "Дмитрий Козлов", subj: "Физика",     grade: "11", pct: 71, paid: false, hw: 0, av: "Д", clr: "#3b82f6", next: "завт. 13:00" },
  { name: "Мария И.",   full: "Мария Иванова",  subj: "Геометрия",  grade: "9",  pct: 92, paid: true,  hw: 1, av: "М", clr: "#8b5cf6", next: "чт 10:00"   },
  { name: "Кирилл Н.", full: "Кирилл Новиков", subj: "Математика", grade: "10", pct: 63, paid: true,  hw: 3, av: "К", clr: "#10b981", next: "пт 17:30"   },
];

// SVG circular progress ring
function SvgRing({ pct, color, size = 44 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="shrink-0" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
      <motion.circle cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
        transition={{ delay: 0.35, duration: 0.85, ease: "easeOut" }} />
    </svg>
  );
}

// ── Students CRM ────────────────────────────────────────────────────────────
function TutorStudentsScreen() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/35 uppercase tracking-wide font-semibold">Мои ученики</span>
        <span className="text-[10px] bg-cyan-500/12 text-cyan-400 border border-cyan-500/20 rounded-full px-2 py-0.5 font-semibold">12 активных</span>
      </div>

      {T_STUDENTS.map((s, i) => {
        const isOpen = open === i;
        return (
          <motion.div key={s.name}
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07, type: "spring", stiffness: 300, damping: 26 }}
            className={cn("rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200",
              isOpen ? "border-white/18 bg-white/8" : "border-white/8 bg-white/4 hover:bg-white/7")}
            onClick={() => setOpen(isOpen ? null : i)}>

            {/* Main row */}
            <div className="flex items-center gap-3 px-3.5 py-3">
              <div className="relative shrink-0">
                <SvgRing pct={s.pct} color={s.clr} size={46} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[13px] font-black" style={{ color: s.clr }}>{s.av}</span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-white/90 truncate">{s.full}</span>
                  <span className={cn("text-[9px] font-bold rounded-full px-1.5 py-0.5 shrink-0",
                    s.paid ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-orange-500/15 text-orange-400 border border-orange-500/20")}>
                    {s.paid ? "✓ ok" : "! долг"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-white/30">{s.grade} кл ·</span>
                  <span className="text-[11px] font-semibold" style={{ color: `${s.clr}bb` }}>{s.subj}</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[15px] font-black tabular-nums" style={{ color: s.clr }}>{s.pct}%</p>
                {s.hw > 0
                  ? <p className="text-[10px] text-amber-400 font-semibold">{s.hw} ДЗ ждёт</p>
                  : <p className="text-[10px] text-white/20">ДЗ ok</p>}
              </div>
            </div>

            {/* Expanded detail */}
            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                  className="border-t border-white/8 px-3.5 pb-3 pt-2.5">
                  <div className="grid grid-cols-3 gap-2 mb-2.5">
                    {[
                      { label: "Ближайший урок", val: s.next,        color: s.clr },
                      { label: "Домашних работ", val: `${s.hw} шт`,  color: "#f59e0b" },
                      { label: "Успеваемость",   val: `${s.pct}%`,   color: "#34d399" },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="rounded-xl bg-white/5 border border-white/6 p-2 text-center">
                        <p className="text-[9px] text-white/30 mb-0.5">{label}</p>
                        <p className="text-[11px] font-bold" style={{ color }}>{val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    {["💬 Написать", "📅 + Урок", "📝 Задание"].map(a => (
                      <motion.button key={a} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                        className="flex-1 text-[10px] font-semibold text-white/50 bg-white/5 hover:bg-white/12 border border-white/10 rounded-xl py-1.5 transition-colors cursor-pointer">
                        {a}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
        className="text-center text-[10px] text-white/20 pt-0.5">+ ещё 8 учеников в базе</motion.p>
    </div>
  );
}

// ── Finance ─────────────────────────────────────────────────────────────────
const WEEK_INC  = [12400, 15800,     0, 18000, 21600,     0, 16200]; // Mon–Sun
const WEEK_PREV = [ 9000, 14200,  8000,     0, 19800,     0, 12000];
const WINC_MAX  = Math.max(...WEEK_INC, ...WEEK_PREV);
const FIN_SUBJ  = [
  { label: "Математика", v: "52 000", pct: 62, c: "bg-gradient-to-r from-cyan-500 to-blue-500" },
  { label: "Физика",     v: "18 000", pct: 21, c: "bg-gradient-to-r from-blue-500 to-indigo-500"},
  { label: "Химия",      v: "14 000", pct: 17, c: "bg-gradient-to-r from-violet-500 to-purple-500"},
];

function TutorFinanceScreen() {
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setCount(0); setReady(false);
    let n = 0; const step = Math.ceil(84000 / 38);
    const id = setInterval(() => { n = Math.min(n + step, 84000); setCount(n); if (n >= 84000) clearInterval(id); }, 28);
    const t = setTimeout(() => setReady(true), 200);
    return () => { clearInterval(id); clearTimeout(t); };
  }, []);

  return (
    <div className="space-y-2.5">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/50 via-slate-900/40 to-cyan-950/30 p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[11px] text-emerald-400/60 uppercase tracking-wider font-bold">Доход · Апрель 2025</p>
            <p className="text-[32px] font-black text-white leading-none mt-1 tabular-nums">
              {count.toLocaleString("ru")} ₽
            </p>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
            className="flex items-center gap-1.5 bg-emerald-500/18 border border-emerald-500/25 rounded-xl px-3 py-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[13px] font-black text-emerald-400">+14%</span>
          </motion.div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-white/35">Цель месяца: 100 000 ₽</span>
            <span className="text-emerald-400 font-bold">84%</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
              initial={{ width: 0 }} animate={{ width: "84%" }}
              transition={{ delay: 0.35, duration: 1.1, ease: "easeOut" }} />
          </div>
          <p className="text-[10px] text-white/28">До цели: 16 000 ₽ · ≈ 9 уроков</p>
        </div>
      </motion.div>

      {/* 7-day bar chart */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-2xl border border-white/8 bg-white/4 p-3.5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] text-white/40 uppercase tracking-wide font-semibold">Доходы по дням</span>
          <div className="flex items-center gap-3 text-[9px] text-white/35">
            <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-full bg-emerald-400/55" /> Эта нед.</span>
            <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-full bg-white/18" /> Прошлая</span>
          </div>
        </div>
        <div className="flex items-end gap-2" style={{ height: 72 }}>
          {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((d, i) => {
            const cur = WEEK_INC[i], prev = WEEK_PREV[i], isToday = i === 1;
            return (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-px" style={{ height: 56 }}>
                  <motion.div className="flex-1 rounded-t-sm bg-white/12"
                    initial={{ height: 0 }} animate={{ height: ready && prev > 0 ? `${(prev/WINC_MAX)*100}%` : 4 }}
                    transition={{ delay: 0.2 + i * 0.04, duration: 0.55 }}
                    style={{ alignSelf: "flex-end", minHeight: prev > 0 ? 4 : 0 }} />
                  <motion.div
                    className={isToday ? "flex-1 rounded-t-sm bg-gradient-to-t from-emerald-500 to-cyan-400" : "flex-1 rounded-t-sm bg-emerald-400/50"}
                    initial={{ height: 0 }} animate={{ height: ready && cur > 0 ? `${(cur/WINC_MAX)*100}%` : 4 }}
                    transition={{ delay: 0.25 + i * 0.04, duration: 0.55 }}
                    style={{ alignSelf: "flex-end", minHeight: cur > 0 ? 4 : 0 }} />
                </div>
                <span className={cn("text-[9px] font-bold", isToday ? "text-cyan-400" : "text-white/28")}>{d}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Subject breakdown */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-2xl border border-white/8 bg-white/4 px-3.5 py-3">
        <span className="text-[11px] text-white/40 uppercase tracking-wide font-semibold">По предметам</span>
        {/* Stacked bar */}
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mt-2 mb-3">
          {FIN_SUBJ.map((s, i) => (
            <motion.div key={s.label} className={cn("h-full rounded-sm", s.c)}
              initial={{ width: 0 }} animate={{ width: ready ? `${s.pct}%` : 0 }}
              transition={{ delay: 0.38 + i * 0.09, duration: 0.65 }} />
          ))}
        </div>
        <div className="space-y-1.5">
          {FIN_SUBJ.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.07 }}
              className="flex items-center gap-2.5">
              <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", s.c)} />
              <span className="text-[12px] text-white/60 flex-1">{s.label}</span>
              <span className="text-[12px] font-bold text-white/85">{s.v} ₽</span>
              <span className="text-[10px] text-white/30 w-8 text-right">{s.pct}%</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Pending payment */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="flex items-center gap-3 rounded-xl border border-orange-500/22 bg-orange-500/6 px-3.5 py-2.5">
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.8 }}>
          <AlertCircle className="h-4.5 w-4.5 text-orange-400 shrink-0" style={{ width: 18, height: 18 }} />
        </motion.div>
        <div className="flex-1">
          <span className="text-[12px] text-white/65">Ожидает оплаты</span>
          <span className="text-[13px] font-black text-orange-400 ml-2">3 600 ₽</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-orange-400/80 font-semibold">2 ученика</p>
          <p className="text-[10px] text-white/30">напомнить →</p>
        </div>
      </motion.div>
    </div>
  );
}

// ── Schedule (visual timeline) ───────────────────────────────────────────
const TL_START = 9 * 60, TL_END = 19 * 60, TL_SPAN = TL_END - TL_START;
const TL_H = 200;
const TL_LESSONS = [
  { start: 10*60, dur: 60, name: "Анна С.",    subj: "Алгебра",    color: "#06b6d4", status: "done"   },
  { start: 13*60, dur: 60, name: "Дмитрий К.", subj: "Физика",     color: "#3b82f6", status: "done"   },
  { start: 15*60, dur: 60, name: "Мария И.",   subj: "Геометрия",  color: "#8b5cf6", status: "active" },
  { start: 17*60+30, dur: 60, name: "Кирилл Н.",subj: "Математика",color: "#10b981", status: "soon"   },
];
const WEEK_CNT = [2, 4, 1, 4, 2, 0]; // Пн–Сб lesson counts

function TutorScheduleScreen() {
  return (
    <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/35 uppercase tracking-wide font-semibold">Вт, 8 апреля · Расписание</span>
          <span className="text-[10px] text-cyan-400/70">4 урока сегодня</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/8 bg-white/3 p-3.5 overflow-hidden">
          <div className="relative" style={{ height: TL_H }}>
            {/* Hour grid lines */}
            {[9, 11, 13, 15, 17, 19].map(h => {
              const pct = ((h * 60 - TL_START) / TL_SPAN) * 100;
              return (
                <div key={h} className="absolute left-0 right-0 flex items-center gap-2" style={{ top: `${pct}%` }}>
                  <span className="text-[9px] text-white/22 w-9 text-right shrink-0 tabular-nums">{h}:00</span>
                  <div className="flex-1 h-px bg-white/6" />
                </div>
              );
            })}

            {/* Lesson blocks */}
            {TL_LESSONS.map((l, i) => {
              const top  = ((l.start - TL_START) / TL_SPAN) * TL_H;
              const h    = Math.max((l.dur / TL_SPAN) * TL_H - 3, 30);
              return (
                <motion.div key={i}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.1, type: "spring", stiffness: 300, damping: 28 }}
                  style={{
                    position: "absolute", top, left: 44, right: 0, height: h,
                    backgroundColor: `${l.color}18`,
                    borderLeft: `3px solid ${l.color}${l.status === "active" ? "ff" : "88"}`,
                  }}
                  className="rounded-r-xl px-2.5 py-1 overflow-hidden">
                  {l.status === "active" && (
                    <motion.div className="absolute inset-0 rounded-r-xl"
                      style={{ backgroundColor: `${l.color}10` }}
                      animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.6 }} />
                  )}
                  <div className="relative flex items-center justify-between h-full">
                    <div>
                      <p className="text-[12px] font-bold leading-none" style={{ color: l.color }}>{l.name}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{l.subj}</p>
                    </div>
                    <div className="shrink-0">
                      {l.status === "done"   && <CheckCircle2 className="h-3.5 w-3.5 text-white/25" />}
                      {l.status === "active" && <motion.div className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: l.color }}
                        animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }} />}
                      {l.status === "soon"   && <ChevronRight className="h-3.5 w-3.5 text-white/25" />}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Week strip */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-xl border border-white/6 bg-white/3 px-3.5 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-white/35 font-semibold uppercase tracking-wide">8–13 апреля</span>
            <div className="flex items-center gap-1.5 text-[9px] text-white/28">
              <Video className="h-3 w-3" /> <span>Jitsi / BigBlueButton</span>
            </div>
          </div>
          <div className="flex gap-2">
            {["Пн","Вт","Ср","Чт","Пт","Сб"].map((d, i) => {
              const n = WEEK_CNT[i], isToday = i === 1;
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <span className={cn("text-[9px] font-bold", isToday ? "text-cyan-300" : "text-white/28")}>{d}</span>
                  <div className={cn("w-full rounded-lg flex items-center justify-center font-black text-[11px]",
                    isToday ? "bg-cyan-500/22 text-cyan-300 border border-cyan-500/35" : n > 0 ? "bg-white/8 text-white/40" : "bg-white/3 text-white/15")}
                    style={{ height: 28 }}>
                    {n > 0 ? n : "–"}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
    </div>
  );
}

// ── AI Assistant ─────────────────────────────────────────────────────────────
const AI_MODES = [
  { id: "plan",    label: "📋 План",     hint: "Планирование урока" },
  { id: "tasks",   label: "🔬 Задачи",   hint: "Генерация заданий"  },
  { id: "analyze", label: "📊 Анализ",   hint: "Анализ прогресса"   },
];
const AI_DEMOS: Record<string, { q: string; lines: string[] }> = {
  plan: {
    q: "Составь план: тригонометрия, 10 класс, 50 мин",
    lines: [
      "Готово! Урок на 50 мин:",
      "① Единичная окружность — 10 мин",
      "② sin / cos / tan, определения — 12 мин",
      "③ Таблица значений — 8 мин",
      "④ Задачи формата ЕГЭ — 12 мин",
      "⑤ Домашнее задание — 8 мин",
    ],
  },
  tasks: {
    q: "Задачи по производным для Анны С. (уровень 84%)",
    lines: [
      "Подобрал задачи по уровню (средне-сложный):",
      "1. f(x) = x³ − 3x + 2, найти f′(x)",
      "2. y = sin²(x), найти y′",
      "3. g(x) = eˣ · ln(x), найти g′(x)",
      "4. h(x) = (x²+1)/(x−1), найти h′(2)",
    ],
  },
  analyze: {
    q: "Проанализируй успеваемость Кирилла Н. (63%)",
    lines: [
      "Анализ завершён. Выявлены проблемные зоны:",
      "⚠ Тригонометрия: 48% верных ответов",
      "⚠ Производные: пропускает этапы решения",
      "✓ Алгебра: стабильно 71%, прогресс есть",
      "💡 Рекомендую: 2 дополнительных урока",
    ],
  },
};

function TutorAIScreen() {
  const [mode, setMode] = useState("plan");
  const [lines, setLines] = useState<string[]>([]);
  const demo = AI_DEMOS[mode];

  useEffect(() => {
    setLines([]);
    let i = 0;
    let stopped = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const next = () => {
      if (stopped || i >= demo.lines.length) return;
      setLines(prev => [...prev, demo.lines[i]]);
      i++;
      timers.push(setTimeout(next, 480 + i * 30));
    };
    timers.push(setTimeout(next, 600));
    return () => { stopped = true; timers.forEach(clearTimeout); };
  }, [mode]);

  return (
    <div className="space-y-2.5">
      {/* Mode switcher */}
      <div className="flex gap-1.5">
        {AI_MODES.map(m => (
          <motion.button key={m.id} onClick={() => setMode(m.id)}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
            className={cn("flex-1 text-[11px] font-bold rounded-xl px-2 py-2.5 border transition-all cursor-pointer",
              mode === m.id ? "bg-white/14 border-white/22 text-white" : "bg-white/3 border-white/8 text-white/40 hover:text-white/65")}>
            {m.label}
          </motion.button>
        ))}
      </div>

      {/* Chat window */}
      <AnimatePresence mode="wait">
        <motion.div key={mode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/40 to-slate-900/30 p-3.5">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/6">
            <motion.div className="h-7 w-7 rounded-xl bg-violet-500/28 flex items-center justify-center"
              animate={{ boxShadow: ["0 0 0 0 rgba(139,92,246,0)", "0 0 0 6px rgba(139,92,246,0.18)", "0 0 0 0 rgba(139,92,246,0)"] }}
              transition={{ repeat: Infinity, duration: 2.2 }}>
              <BrainCircuit className="h-4 w-4 text-violet-300" />
            </motion.div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-violet-300/80">Репетитор-ИИ</p>
              <p className="text-[9px] text-white/28">GPT-4o · персонализированный</p>
            </div>
            <motion.div className="h-2 w-2 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} />
          </div>

          {/* User message */}
          <div className="flex justify-end mb-3">
            <div className="bg-violet-500/22 border border-violet-500/20 text-violet-100 text-[11px] rounded-xl rounded-br-sm px-3 py-2 max-w-[90%] leading-relaxed">
              {demo.q}
            </div>
          </div>

          {/* AI streaming reply */}
          <div className="space-y-1">
            {lines.filter(Boolean).map((line, i) => (
              <motion.p key={`${mode}-${i}`}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                className={cn("text-[11px] leading-relaxed",
                  line.startsWith("⚠") ? "text-amber-300" :
                  line.startsWith("✓") ? "text-emerald-400" :
                  line.startsWith("💡") ? "text-cyan-300" :
                  i === 0 ? "text-white/85 font-semibold" : "text-white/60")}>
                {line}
              </motion.p>
            ))}
            {lines.length < demo.lines.length && (
              <div className="flex gap-1 pt-0.5">
                {[0,1,2].map(j => (
                  <motion.div key={j} className="h-1 w-1 rounded-full bg-violet-400/55"
                    animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.8, delay: j * 0.14 }} />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Capability chips */}
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { icon: ClipboardList, label: "Планы уроков",    c: "text-cyan-300",    b: "border-cyan-500/18 bg-cyan-500/6"    },
          { icon: FlaskConical,  label: "Генерация задач",  c: "text-violet-300",  b: "border-violet-500/18 bg-violet-500/6" },
          { icon: FileText,      label: "Проверка ДЗ",      c: "text-blue-300",    b: "border-blue-500/18 bg-blue-500/6"    },
          { icon: BarChart3,     label: "Анализ прогресса", c: "text-emerald-300", b: "border-emerald-500/18 bg-emerald-500/6"},
        ].map(({ icon: Icon, label, c, b }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.06 }}
            className={cn("flex items-center gap-2 rounded-xl border px-2.5 py-2", b)}>
            <Icon className={cn("h-3.5 w-3.5 shrink-0", c)} />
            <span className={cn("text-[11px] font-semibold", c)}>{label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Overview dashboard ───────────────────────────────────────────────────────
const SPARK = [6200, 0, 8400, 12600, 0, 9800, 15800, 7200];
const SPARK_MAX = Math.max(...SPARK);
const OV_ACTIVITY = [
  { icon: CheckCircle2, text: "Урок с Анной завершён",      sub: "2 мин",  c: "text-emerald-400" },
  { icon: Wallet,       text: "Оплата от Дмитрия: 1 800 ₽", sub: "18 мин", c: "text-cyan-400"    },
  { icon: FileText,     text: "Мария сдала домашку",         sub: "35 мин", c: "text-violet-400"  },
  { icon: Star,         text: "Кирилл: 5 задач решил верно", sub: "1 ч",    c: "text-amber-400"   },
];

function TutorOverviewScreen() {
  const [actIdx, setActIdx] = useState(0);
  const [secs, setSecs] = useState(37 * 60 + 14);
  const [sparkReady, setSparkReady] = useState(false);

  useEffect(() => {
    setActIdx(0); setSparkReady(false);
    let v = 0;
    const tick = () => { if (v >= OV_ACTIVITY.length) return; v++; setActIdx(v); setTimeout(tick, 260); };
    const t1 = setTimeout(tick, 350);
    const t2 = setTimeout(() => setSparkReady(true), 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  useEffect(() => {
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss2 = String(secs % 60).padStart(2, "0");

  return (
    <div className="space-y-2.5">
      {/* Revenue hero + sparkline */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/50 via-slate-900/40 to-cyan-950/20 p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-1">
            <p className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-bold">Апрель 2025</p>
            <p className="text-[30px] font-black text-white leading-tight">84 000 ₽</p>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold text-emerald-400">+14% к марту</span>
            </div>
          </div>
          {/* Sparkline */}
          <div className="flex items-end gap-0.5 shrink-0" style={{ height: 44 }}>
            {SPARK.map((v, i) => (
              <motion.div key={i}
                className={cn("w-3 rounded-t-sm", i === SPARK.length - 1 ? "bg-gradient-to-t from-emerald-500 to-cyan-400" : v > 0 ? "bg-emerald-500/40" : "bg-white/5")}
                initial={{ height: 0 }} animate={{ height: sparkReady ? `${Math.max((v / SPARK_MAX) * 100, v > 0 ? 10 : 0)}%` : 0 }}
                transition={{ delay: 0.1 + i * 0.04, duration: 0.5 }}
                style={{ alignSelf: "flex-end" }} />
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
              initial={{ width: 0 }} animate={{ width: "84%" }}
              transition={{ delay: 0.4, duration: 1, ease: "easeOut" }} />
          </div>
          <div className="flex justify-between text-[9px] text-white/28">
            <span>84 000 ₽ / 100 000 ₽</span><span>84% цели</span>
          </div>
        </div>
      </motion.div>

      {/* Student avatar strip */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
        className="rounded-xl border border-white/8 bg-white/4 px-3.5 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] text-white/35 uppercase tracking-wide font-semibold">Ученики сегодня</span>
          <span className="text-[10px] text-cyan-400/60">4 урока</span>
        </div>
        <div className="flex gap-1.5">
          {T_STUDENTS.map((s, i) => (
            <motion.div key={s.name} className="flex-1 flex flex-col items-center gap-1.5"
              initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.22 + i * 0.08, type: "spring", stiffness: 420, damping: 24 }}>
              <div className="relative">
                <div className="h-10 w-10 rounded-full flex items-center justify-center font-black text-sm border-2"
                  style={{ backgroundColor: `${s.clr}20`, borderColor: `${s.clr}60`, color: s.clr }}>
                  {s.av}
                </div>
                <div className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900",
                  i < 2 ? "bg-white/20" : i === 2 ? "bg-cyan-400" : "bg-white/12")} />
              </div>
              <span className="text-[9px] text-white/35 text-center">{s.name.split(" ")[0]}</span>
            </motion.div>
          ))}
          <motion.div className="flex-1 flex flex-col items-center gap-1.5"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <div className="h-10 w-10 rounded-full bg-white/6 border border-white/12 flex items-center justify-center">
              <span className="text-[10px] text-white/30 font-bold">+8</span>
            </div>
            <span className="text-[9px] text-white/20">ещё</span>
          </motion.div>
        </div>
      </motion.div>

      {/* Next lesson countdown */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.28, type: "spring" }}
        className="rounded-2xl border border-cyan-500/28 bg-cyan-500/8 px-3.5 py-3 flex items-center gap-3">
        <motion.div className="h-10 w-10 rounded-xl bg-cyan-500/22 flex items-center justify-center shrink-0"
          animate={{ boxShadow: ["0 0 0 0 rgba(6,182,212,0)", "0 0 0 8px rgba(6,182,212,0.2)", "0 0 0 0 rgba(6,182,212,0)"] }}
          transition={{ repeat: Infinity, duration: 2 }}>
          <Clock style={{ width: 18, height: 18 }} className="text-cyan-300" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-white/32">Следующий урок · Геометрия</p>
          <p className="text-[13px] font-bold text-white/90">Мария Иванова</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[24px] font-black text-cyan-300 tabular-nums leading-none">{mm}:{ss2}</p>
          <p className="text-[9px] text-white/28">15:00 сегодня</p>
        </div>
      </motion.div>

      {/* Activity */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="rounded-xl border border-white/6 bg-white/3 px-3.5 py-3">
        <p className="text-[11px] text-white/32 uppercase tracking-wide font-semibold mb-2">Активность</p>
        <div className="space-y-2">
          {OV_ACTIVITY.slice(0, actIdx).map(({ icon: Icon, text, sub, c }, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2.5">
              <Icon className={cn("h-3.5 w-3.5 shrink-0", c)} />
              <span className="text-[11px] text-white/60 flex-1 truncate">{text}</span>
              <span className="text-[10px] text-white/22 shrink-0">{sub} назад</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

const tutorTabs = [
  { id: "overview",  icon: BarChart3,        label: "Обзор"      },
  { id: "students",  icon: Users,            label: "Ученики"    },
  { id: "finance",   icon: CircleDollarSign, label: "Финансы"    },
  { id: "schedule",  icon: Calendar,         label: "Расписание" },
  { id: "ai",        icon: Bot,              label: "ИИ-помощник"},
];

function TutorShowcase() {
  const [feature, setFeature] = useState("overview");
  return (
    <div className="w-full flex flex-col gap-3 h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        className="text-center">
        <p className="text-[11px] text-cyan-300/50 uppercase tracking-widest font-semibold mb-0.5">Кабинет репетитора</p>
        <p className="text-xl font-black text-white/95">Управляй обучением</p>
        <p className="text-[12px] text-blue-200/38 mt-0.5">Ученики, финансы, расписание и ИИ — всё в одном</p>
      </motion.div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={feature}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
          >
            {feature === "overview"  && <TutorOverviewScreen />}
            {feature === "students"  && <TutorStudentsScreen />}
            {feature === "finance"   && <TutorFinanceScreen />}
            {feature === "schedule"  && <TutorScheduleScreen />}
            {feature === "ai"        && <TutorAIScreen />}
          </motion.div>
        </AnimatePresence>
      </div>

      <FeatureTabBar tabs={tutorTabs} active={feature} onSelect={setFeature} accent="cyan" />
    </div>
  );
}

// ── STUDENT FEATURE SCREENS ────────────────────────────────────────────────
const weekActivity = [true, true, false, true, true, true, false]; // Mon-Sun, today=Tue
const subjects = [
  { label: "Алгебра",       pct: 85, c: "from-violet-500 to-purple-400",    solved: 142 },
  { label: "Геометрия",     pct: 72, c: "from-blue-500 to-cyan-400",        solved: 87  },
  { label: "Тригонометрия", pct: 61, c: "from-cyan-500 to-emerald-400",     solved: 56  },
];

function StudentProgressScreen() {
  const [xp, setXp] = useState(0);
  const [barsShown, setBarsShown] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setXp(70), 300);
    const t2 = setTimeout(() => setBarsShown(true), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="space-y-2.5">
      {/* Level card with XP milestones */}
      <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="rounded-2xl border border-violet-500/25 bg-violet-500/8 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <motion.div
              className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500/40 to-purple-600/30 flex items-center justify-center ring-2 ring-violet-400/30 shrink-0"
              animate={{ boxShadow: ["0 0 0 0 rgba(139,92,246,0)", "0 0 0 8px rgba(139,92,246,0.2)", "0 0 0 0 rgba(139,92,246,0)"] }}
              transition={{ repeat: Infinity, duration: 2.4, delay: 0.8 }}>
              <span className="text-lg font-black text-violet-200">4</span>
            </motion.div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-white/90">Мастер ЕГЭ</p>
                <span className="text-[10px] bg-violet-500/20 text-violet-300 rounded-full px-1.5 py-0.5 font-semibold">Ур. 4</span>
              </div>
              <p className="text-[11px] text-violet-300/50 mt-0.5">ещё 150 XP → Уровень 5</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1 bg-orange-500/12 rounded-xl px-2.5 py-1 border border-orange-500/20">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-sm font-bold text-orange-300">7</span>
              <span className="text-[10px] text-white/30">дн</span>
            </div>
            <div className="flex items-center gap-1 bg-violet-500/12 rounded-xl px-2.5 py-1 border border-violet-500/20">
              <Zap className="h-3 w-3 text-violet-400" />
              <span className="text-[12px] font-bold text-violet-300">350 XP</span>
            </div>
          </div>
        </div>

        {/* XP bar with level markers */}
        <div className="relative">
          <div className="flex justify-between text-[9px] text-white/25 mb-1">
            <span>Ур.4 · 200 XP</span>
            <span className="text-violet-400/60">◆ Ур.5 · 500 XP</span>
          </div>
          <div className="h-3 rounded-full bg-white/8 overflow-hidden relative">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-pink-400"
              initial={{ width: 0 }} animate={{ width: `${xp}%` }}
              transition={{ delay: 0.4, duration: 1, ease: "easeOut" }} />
            {/* Milestone marker at 50% */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-white/20 rounded-full" style={{ left: "50%" }} />
          </div>
          <div className="flex justify-between text-[9px] mt-1">
            <span className="text-violet-400/70">350 / 500 XP</span>
            <motion.span className="text-violet-300/60 font-semibold"
              animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }}>
              +150 до следующего уровня
            </motion.span>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: BookOpen, val: "18",   label: "Уроков",   c: "text-blue-300",    bg: "bg-blue-500/12",    delay: 0.12 },
          { icon: Target,   val: "94%",  label: "Верных",   c: "text-emerald-300", bg: "bg-emerald-500/12", delay: 0.17 },
          { icon: Trophy,   val: "5",    label: "Медалей",  c: "text-amber-300",   bg: "bg-amber-500/12",   delay: 0.22 },
        ].map(({ icon: Icon, val, label, c, bg, delay }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
            whileHover={{ scale: 1.05, y: -2 }}
            className="rounded-xl border border-white/6 bg-white/4 p-2.5 text-center cursor-default">
            <div className={cn("h-7 w-7 rounded-lg mx-auto mb-1.5 flex items-center justify-center", bg)}>
              <Icon className={cn("h-3.5 w-3.5", c)} />
            </div>
            <p className="text-sm font-black text-white/90">{val}</p>
            <p className="text-[10px] text-white/30">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Weekly activity strip */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
        className="rounded-xl border border-white/6 bg-white/4 px-3.5 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wide">Активность недели</span>
          <span className="text-[10px] text-violet-400/60">5 из 7 дней</span>
        </div>
        <div className="flex gap-1.5 items-end">
          {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map((d, i) => {
            const active = weekActivity[i];
            const isToday = i === 1;
            return (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                  transition={{ delay: 0.35 + i * 0.06, type: "spring" }}
                  className={cn("w-full rounded-md",
                    isToday ? "bg-violet-400/90" : active ? "bg-violet-500/40" : "bg-white/8")}
                  style={{ height: isToday ? 24 : active ? 18 : 10 }}
                />
                <span className={cn("text-[9px] font-semibold", isToday ? "text-violet-300" : "text-white/25")}>{d}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Subject breakdown */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="rounded-xl border border-white/6 bg-white/4 px-3.5 py-3">
        <span className="text-[11px] text-white/40 font-semibold uppercase tracking-wide">По предметам</span>
        <div className="space-y-2 mt-2">
          {subjects.map((s, i) => (
            <div key={s.label}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-white/65">{s.label}</span>
                <span className="text-white/40">{s.solved} задач · <span className="text-white/65 font-semibold">{s.pct}%</span></span>
              </div>
              <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                <motion.div className={cn("h-full rounded-full bg-gradient-to-r", s.c)}
                  initial={{ width: 0 }} animate={{ width: barsShown ? `${s.pct}%` : 0 }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.75, ease: "easeOut" }} />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Today's goals */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="rounded-xl border border-white/6 bg-white/4 px-3.5 py-3">
        <p className="text-[11px] text-white/40 font-semibold uppercase tracking-wide mb-2">Цели на сегодня</p>
        {[
          { label: "Решить 5 задач по алгебре", done: true,  xp: "+25 XP" },
          { label: "Повторить: Тригонометрия",  done: true,  xp: "+15 XP" },
          { label: "Онлайн-урок в 17:00",       done: false, xp: "+30 XP" },
        ].map(({ label, done, xp: reward }, i) => (
          <motion.div key={label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.07 }} className="flex items-center gap-2 mt-1.5">
            <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0", done ? "text-emerald-400" : "text-white/15")} />
            <span className={cn("text-[12px] flex-1", done ? "line-through text-white/25" : "text-white/60")}>{label}</span>
            <span className={cn("text-[10px] font-semibold shrink-0", done ? "text-emerald-400/70" : "text-violet-400/60")}>{reward}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function StudentTasksScreen() {
  const [selected, setSelected] = useState<number | null>(null);
  const options = ["sin(x)·cos(x)", "2·sin(x)·cos(x)", "cos²(x)−sin²(x)", "sin(2x)"];
  const correct = 1;
  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-cyan-500/22 bg-cyan-500/6 p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="h-4 w-4 text-cyan-400" />
          <span className="text-[11px] font-semibold text-cyan-300/70 uppercase tracking-wide">Задача №1042 · Алгебра</span>
          <span className="ml-auto text-[10px] text-white/28">ЕГЭ 2024</span>
        </div>
        <p className="text-[13px] text-white/85 leading-relaxed mb-4">
          Найдите производную функции <span className="font-mono font-bold text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded-md">f(x) = sin²(x)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {options.map((opt, i) => (
            <motion.button
              key={i}
              onClick={() => setSelected(i)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              animate={selected === i ? {
                backgroundColor: i === correct ? "rgba(52,211,153,0.18)" : "rgba(239,68,68,0.15)",
                borderColor:     i === correct ? "rgba(52,211,153,0.45)" : "rgba(239,68,68,0.4)",
              } : {}}
              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-[12px] font-mono text-white/65 text-left transition-colors cursor-pointer hover:bg-white/10 hover:border-white/22"
            >
              {String.fromCharCode(65+i)}. {opt}
            </motion.button>
          ))}
        </div>
        {selected !== null && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={cn("mt-3 rounded-xl px-3 py-2 text-[12px] leading-relaxed",
              selected === correct ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25" : "bg-red-500/12 text-red-300 border border-red-500/22")}>
            {selected === correct
              ? "✓ Верно! (sin²x)' = 2·sin(x)·cos(x) = sin(2x)"
              : "✗ Неверно. Используй ИИ-помощника для объяснения"}
          </motion.div>
        )}
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/3 px-3.5 py-2.5">
        <Zap className="h-4 w-4 text-violet-400 shrink-0" />
        <span className="text-[12px] text-white/55">Правильный ответ даёт <span className="text-violet-300 font-bold">+10 XP</span></span>
        <span className="ml-auto text-[10px] text-white/30">832 задачи в базе</span>
      </motion.div>
    </div>
  );
}

const studentAiMsgs = [
  { from: "user", text: "Объясни производную sin²(x)" },
  { from: "ai",   text: "__formula__" },
];
function StudentAIScreen() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    let i = 0;
    const next = () => {
      if (i >= studentAiMsgs.length) return;
      setShown(i + 1); i++;
      setTimeout(next, 1000);
    };
    const t = setTimeout(next, 500);
    return () => clearTimeout(t);
  }, []);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-500/22 bg-violet-500/6 p-3.5">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-full bg-violet-500/25 flex items-center justify-center shrink-0">
          <BrainCircuit className="h-3.5 w-3.5 text-violet-300" />
        </div>
        <span className="text-[11px] font-semibold text-violet-300/70">ИИ-помощник</span>
        <motion.span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 block" animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} />
      </div>
      <div className="space-y-2">
        {studentAiMsgs.slice(0, shown).map(({ from, text }, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cn("flex", from === "user" ? "justify-end" : "justify-start")}>
            {text === "__formula__" ? (
              <div className="bg-white/8 text-white/70 rounded-xl rounded-bl-sm px-3 py-2.5 max-w-[90%] space-y-2">
                <p className="text-[11px] text-white/60">По правилу цепочки:</p>
                <div className="rounded-lg bg-white/8 border border-white/10 px-3 py-2 font-mono text-[12px] text-cyan-300">
                  (sin²x)' = 2·sin(x)·cos(x)
                </div>
                <div className="rounded-lg bg-emerald-500/12 border border-emerald-500/22 px-3 py-2 font-mono text-[12px] text-emerald-300">
                  = sin(2x) ✓
                </div>
                <p className="text-[10px] text-white/40">Тождество: 2sin(x)cos(x) = sin(2x)</p>
              </div>
            ) : (
              <div className={cn("text-[11px] rounded-xl px-3 py-2 max-w-[88%] leading-relaxed",
                from === "user" ? "bg-violet-500/22 text-violet-100 rounded-br-sm" : "bg-white/8 text-white/70 rounded-bl-sm")}>
                {text}
              </div>
            )}
          </motion.div>
        ))}
        {shown < studentAiMsgs.length && (
          <div className="flex justify-start">
            <div className="bg-white/6 rounded-xl rounded-bl-sm px-3 py-2 flex gap-1">
              {[0,1,2].map(i => (
                <motion.div key={i} className="h-1 w-1 rounded-full bg-white/35"
                  animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

const achList = [
  { icon: "🔥", name: "Стрик 7 дней",    desc: "7 дней подряд",      c: "border-orange-500/25 bg-orange-500/8"  },
  { icon: "⚡", name: "Скорострел",       desc: "10 задач за час",     c: "border-yellow-500/25 bg-yellow-500/8"  },
  { icon: "🎯", name: "Снайпер",          desc: "94% верных ответов",  c: "border-emerald-500/25 bg-emerald-500/8"},
  { icon: "🏆", name: "Мастер ЕГЭ",       desc: "Уровень 4",           c: "border-violet-500/25 bg-violet-500/8"  },
  { icon: "📚", name: "Книгочей",          desc: "18 уроков",           c: "border-blue-500/25 bg-blue-500/8"     },
  { icon: "🌟", name: "Суперстар",         desc: "5 медалей",           c: "border-amber-500/25 bg-amber-500/8"   },
];
function StudentAchievementsScreen() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40 uppercase tracking-wide font-semibold">Мои достижения</span>
        <span className="text-[10px] text-violet-400/60">5 из 24</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {achList.map((a, i) => (
          <motion.div
            key={a.name}
            initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.04, y: -2 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 280, damping: 22 }}
            className={cn("rounded-xl border p-2.5 flex items-center gap-2.5 cursor-default", a.c)}
          >
            <span className="text-xl shrink-0">{a.icon}</span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white/85 leading-tight truncate">{a.name}</p>
              <p className="text-[10px] text-white/40 leading-tight mt-0.5">{a.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const studentSchedule = [
  { time: "17:00", day: "Сегодня",  subject: "Алгебра",     teacher: "Елена Сергеевна", type: "video",  status: "next"     },
  { time: "14:30", day: "Завтра",   subject: "Геометрия",   teacher: "Елена Сергеевна", type: "video",  status: "upcoming" },
  { time: "10:00", day: "Чт",       subject: "Алгебра",     teacher: "Елена Сергеевна", type: "video",  status: "upcoming" },
];
function StudentScheduleScreen() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-white/40 uppercase tracking-wide font-semibold">Ближайшие уроки</span>
      </div>
      {studentSchedule.map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 280, damping: 24 }}
          className={cn("flex items-center gap-3 rounded-xl border px-3.5 py-3",
            s.status === "next" ? "border-violet-500/30 bg-violet-500/10" : "border-white/8 bg-white/4")}
        >
          <div className="text-center shrink-0 w-12">
            <p className={cn("text-[13px] font-black", s.status === "next" ? "text-violet-300" : "text-white/65")}>{s.time}</p>
            <p className="text-[10px] text-white/35 mt-0.5">{s.day}</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-white/85 truncate">{s.subject}</p>
            <p className="text-[10px] text-white/35">{s.teacher}</p>
          </div>
          <div className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold",
            s.status === "next" ? "bg-violet-500/20 text-violet-300" : "bg-white/6 text-white/35")}>
            <Video className="h-3 w-3" />
            {s.status === "next" ? "Скоро" : "Урок"}
          </div>
        </motion.div>
      ))}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
        className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-3.5 py-2.5 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-violet-400 shrink-0" />
        <span className="text-[12px] text-white/55">Есть вопрос? <span className="text-violet-300 font-semibold">Написать репетитору</span></span>
      </motion.div>
    </div>
  );
}

const studentTabs = [
  { id: "progress",      icon: TrendingUp,  label: "Прогресс"     },
  { id: "tasks",         icon: FlaskConical,label: "Задачник ЕГЭ" },
  { id: "ai",            icon: Bot,         label: "ИИ-помощник"  },
  { id: "achievements",  icon: Trophy,      label: "Достижения"   },
  { id: "schedule",      icon: Calendar,    label: "Расписание"   },
];

function StudentShowcase() {
  const [feature, setFeature] = useState("progress");
  return (
    <div className="w-full flex flex-col gap-3 h-full">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        className="text-center">
        <p className="text-[11px] text-violet-300/50 uppercase tracking-widest font-semibold mb-0.5">Кабинет ученика</p>
        <p className="text-xl font-black text-white/95">Твоё пространство для роста</p>
        <p className="text-[12px] text-blue-200/38 mt-0.5">Задачник, ИИ, достижения и расписание</p>
      </motion.div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={feature}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
          >
            {feature === "progress"     && <StudentProgressScreen />}
            {feature === "tasks"        && <StudentTasksScreen />}
            {feature === "ai"           && <StudentAIScreen />}
            {feature === "achievements" && <StudentAchievementsScreen />}
            {feature === "schedule"     && <StudentScheduleScreen />}
          </motion.div>
        </AnimatePresence>
      </div>

      <FeatureTabBar tabs={studentTabs} active={feature} onSelect={setFeature} accent="violet" />
    </div>
  );
}

// ── Floating notification toast ────────────────────────────────────────────
const floatingNotifs = [
  {
    role: "tutor" as const,
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
    bg: "border-emerald-500/20 bg-emerald-500/8",
    title: "Оплата получена",
    sub: "Козлов Дмитрий · 1 800 ₽",
  },
  {
    role: "student" as const,
    icon: Trophy,
    iconColor: "text-amber-400",
    bg: "border-amber-500/20 bg-amber-500/8",
    title: "Новое достижение!",
    sub: "Серия 7 дней подряд 🔥",
  },
  {
    role: "tutor" as const,
    icon: FileText,
    iconColor: "text-violet-400",
    bg: "border-violet-500/20 bg-violet-500/8",
    title: "Домашка сдана",
    sub: "Анна Соколова · только что",
  },
  {
    role: "student" as const,
    icon: Zap,
    iconColor: "text-violet-400",
    bg: "border-violet-500/20 bg-violet-500/8",
    title: "+25 XP заработано",
    sub: "Урок завершён · Алгебра",
  },
];

function FloatingNotif({ activeTab }: { activeTab: "tutor" | "student" }) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const eligible = floatingNotifs.filter(n => n.role === activeTab);
    let idx = 0;
    const show = () => {
      setCurrent(idx % eligible.length);
      setVisible(true);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        timerRef.current = setTimeout(() => { idx++; show(); }, 1200);
      }, 3200);
    };
    timerRef.current = setTimeout(show, 1800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeTab]);

  const eligible = floatingNotifs.filter(n => n.role === activeTab);
  if (!eligible.length) return null;
  const notif = eligible[current % eligible.length];
  const Icon = notif.icon;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className={cn("absolute bottom-20 right-8 z-30 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md max-w-[220px]", notif.bg)}
        >
          <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Icon className={cn("h-4 w-4", notif.iconColor)} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-white/90 leading-tight">{notif.title}</p>
            <p className="text-[10px] text-white/40 mt-0.5 truncate">{notif.sub}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Animated focus input wrapper ───────────────────────────────────────────
function FocusField({ icon: Icon, isTutor, right, children }: {
  icon: any; isTutor: boolean; right?: React.ReactNode; children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const accent = isTutor ? "#3b82f6" : "#8b5cf6";
  return (
    <motion.div
      className="relative rounded-xl border-2 bg-muted/40 transition-colors duration-150"
      animate={{
        borderColor: focused ? accent : "rgba(var(--border),1)",
        boxShadow: focused ? `0 0 0 4px ${accent}22, 0 2px 8px ${accent}18` : "0 0 0 0px transparent",
      }}
      transition={{ duration: 0.18 }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      <motion.div
        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"
        animate={{ color: focused ? accent : "var(--muted-foreground)" }}
        transition={{ duration: 0.18 }}
      >
        <Icon className="h-4 w-4" />
      </motion.div>
      {children}
      {right}
    </motion.div>
  );
}

// ── Shake on error ─────────────────────────────────────────────────────────
function ShakeBox({ children }: { children: React.ReactNode }) {
  const controls = useAnimation();
  useEffect(() => {
    controls.start({
      x: [0, -10, 10, -8, 8, -4, 4, 0],
      transition: { duration: 0.5, ease: "easeInOut" },
    });
  }, []);
  return <motion.div animate={controls}>{children}</motion.div>;
}

// ── Animated submit button ─────────────────────────────────────────────────
function AnimatedSubmitButton({ isTutor, isLoading }: { isTutor: boolean; isLoading: boolean }) {
  const gradFrom = isTutor ? "#2563eb" : "#7c3aed";
  const gradTo   = isTutor ? "#06b6d4" : "#a855f7";
  const shadow   = isTutor ? "rgba(59,130,246," : "rgba(139,92,246,";
  return (
    <motion.button
      type="submit"
      whileHover={!isLoading ? { scale: 1.02, y: -2 } : {}}
      whileTap={!isLoading ? { scale: 0.97 } : {}}
      animate={!isLoading ? {
        boxShadow: [
          `0 4px 20px ${shadow}0.25)`,
          `0 6px 28px ${shadow}0.45)`,
          `0 4px 20px ${shadow}0.25)`,
        ],
      } : {}}
      transition={{
        scale: { type: "spring", stiffness: 380, damping: 22 },
        boxShadow: { repeat: Infinity, duration: 2, ease: "easeInOut" },
      }}
      disabled={isLoading}
      data-testid="button-login-submit"
      style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
      className="relative w-full h-12 text-sm font-semibold rounded-xl text-white overflow-hidden border-0 cursor-pointer disabled:cursor-not-allowed"
    >
      {!isLoading && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)` }}
          animate={{ x: ["-120%", "220%"] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut", repeatDelay: 1.2 }}
        />
      )}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.span key="loading" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
            className="flex items-center justify-center gap-2">
            <motion.span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white block"
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }} />
            Вхожу…
          </motion.span>
        ) : (
          <motion.span key="idle" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}>
            {isTutor ? "Войти как репетитор →" : "Войти как ученик →"}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function Login() {
  useDocumentTitle("Вход");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"tutor" | "student">("tutor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, loginData, isLoginPending, loginError, verify2FA, is2FAPending, twoFactorError, resetLogin } = useAuth();
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const requires2FA = !!(loginData as any)?.requires2FA;

  const studentLogin = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await fetch("/api/student/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ошибка входа");
      }
      return res.json();
    },
    onSuccess: () => setLocation("/student"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "tutor") {
      if (requires2FA) {
        verify2FA({ code: twoFactorCode.trim() });
      } else {
        login({ email, password });
      }
    } else {
      studentLogin.mutate({ email, password });
    }
  };

  const handleResend2FA = async () => {
    try {
      await fetch("/api/auth/2fa/resend", { method: "POST", credentials: "include" });
    } catch {}
  };

  const handleCancel2FA = () => {
    resetLogin();
    setTwoFactorCode("");
  };

  const isLoading = activeTab === "tutor" ? (requires2FA ? is2FAPending : isLoginPending) : studentLogin.isPending;
  const error = activeTab === "tutor" ? (requires2FA ? twoFactorError : loginError) : studentLogin.error;
  const isTutor = activeTab === "tutor";

  return (
    <div className="min-h-screen flex">
      {/* ── LEFT PANEL ──────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-gradient-to-br from-[#0e0b22] via-[#0a0618] to-[#050314]">
        {/* Animated bg blobs */}
        <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.14, 0.22, 0.14] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-5%] left-[-5%] w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.16, 0.08] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-violet-600/12 rounded-full blur-[120px] pointer-events-none" />
        <motion.div animate={{ x: [0, 25, 0], y: [0, -18, 0], opacity: [0.06, 0.13, 0.06] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-[40%] left-[30%] w-[350px] h-[350px] bg-cyan-500/10 rounded-full blur-[90px] pointer-events-none" />

        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(139,92,246,0.6) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }} />

        <FloatingNotif activeTab={activeTab} />

        {/* Content */}
        <div className="relative z-10 flex flex-col w-full p-10 pt-8 overflow-y-auto gap-0">
          {/* Logo */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex items-center gap-3 flex-wrap">
              <BrandLogo size="lg" />
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, type: "spring" }}
                className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1">
                <Sparkles className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">v3.6</span>
              </motion.div>
            </div>
            <p className="text-blue-200/35 text-sm mt-1.5 font-medium">AI-платформа для репетиторов и учеников</p>
          </motion.div>

          {/* Role toggle */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="flex gap-2 mt-6 mb-4">
            {[
              { value: "student" as const, icon: GraduationCap, label: "Ученикам",    color: "violet" },
              { value: "tutor"   as const, icon: Users,          label: "Репетиторам", color: "cyan"   },
            ].map(tab => (
              <motion.button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all border cursor-pointer",
                  activeTab === tab.value
                    ? tab.color === "cyan"
                      ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300"
                      : "bg-violet-500/20 border-violet-400/40 text-violet-300"
                    : "border-white/8 text-white/30 hover:text-white/55 hover:border-white/18"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </motion.button>
            ))}
          </motion.div>

          {/* Showcase area — flex-1 with internal overflow */}
          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">
              {activeTab === "tutor" ? (
                <motion.div key="tutor-show" className="h-full"
                  initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -22 }}
                  transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                  <TutorShowcase />
                </motion.div>
              ) : (
                <motion.div key="student-show" className="h-full"
                  initial={{ opacity: 0, x: -22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 22 }}
                  transition={{ type: "spring", stiffness: 280, damping: 26 }}>
                  <StudentShowcase />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Trust row */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
            className="flex items-center gap-4 pt-4 mt-3 border-t border-white/5 shrink-0">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400/40" />
              <span className="text-[11px] text-white/20">Данные защищены</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-400/40" />
              <span className="text-[11px] text-white/20">Только для репетиторов РФ</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── RIGHT PANEL (form) ───────────────────────────────────── */}
      <div className="w-full lg:w-[48%] flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <motion.div className="lg:hidden flex justify-center mb-8"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <BrandLogoLight size="sm" />
          </motion.div>

          {/* Heading */}
          <motion.div className="mb-7"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Войдите в аккаунт</h1>
            <p className="text-sm text-muted-foreground mt-1.5">Выберите, кто вы — и войдите в свой кабинет</p>
          </motion.div>

          {/* Role picker */}
          <motion.div className="grid grid-cols-2 gap-3 mb-7"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12, type: "spring", stiffness: 200, damping: 22 }}>
            {([
              {
                value: "student" as const, icon: GraduationCap,
                label: "Я ученик", desc: "Занятия, домашка, прогресс",
                accent: "#8b5cf6", accentLight: "rgba(139,92,246,",
                checkColor: "text-violet-500",
                activeBorder: "border-violet-500", activeBg: "bg-violet-50 dark:bg-violet-950/50",
              },
              {
                value: "tutor" as const, icon: Users,
                label: "Я репетитор", desc: "Ученики, расписание, финансы",
                accent: "#3b82f6", accentLight: "rgba(59,130,246,",
                checkColor: "text-blue-500",
                activeBorder: "border-blue-500", activeBg: "bg-blue-50 dark:bg-blue-950/50",
              },
            ]).map((role) => {
              const isActive = activeTab === role.value;
              return (
                <motion.button
                  key={role.value}
                  type="button"
                  onClick={() => { setActiveTab(role.value); setEmail(""); setPassword(""); }}
                  data-testid={`button-role-${role.value}`}
                  whileHover={{ scale: 1.04, y: -3 }}
                  whileTap={{ scale: 0.94 }}
                  animate={isActive ? {
                    boxShadow: [
                      `0 0 0 2px ${role.accent}, 0 4px 20px ${role.accentLight}0.2)`,
                      `0 0 0 2px ${role.accent}, 0 8px 32px ${role.accentLight}0.38)`,
                      `0 0 0 2px ${role.accent}, 0 4px 20px ${role.accentLight}0.2)`,
                    ],
                  } : {
                    boxShadow: "0 0 0 1.5px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.04)",
                  }}
                  transition={{
                    scale: { type: "spring", stiffness: 350, damping: 20 },
                    boxShadow: isActive ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" } : { duration: 0.25 },
                  }}
                  className={cn(
                    "relative flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left cursor-pointer overflow-hidden",
                    isActive ? `${role.activeBorder} ${role.activeBg}` : "border-border/50 bg-card hover:bg-muted/50"
                  )}
                >
                  {isActive && (
                    <motion.div className="absolute inset-0 pointer-events-none"
                      style={{ background: `radial-gradient(ellipse at 30% 50%, ${role.accentLight}0.1) 0%, transparent 70%)` }}
                      animate={{ opacity: [0.6, 1, 0.6] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }} />
                  )}
                  <div className="relative flex items-center justify-between w-full mb-1.5">
                    <motion.div className="flex h-9 w-9 items-center justify-center rounded-xl"
                      animate={{ backgroundColor: isActive ? `${role.accentLight}0.18)` : "rgba(0,0,0,0.06)" }}
                      transition={{ duration: 0.25 }}>
                      <motion.div animate={{ color: isActive ? role.accent : "var(--muted-foreground)" }} transition={{ duration: 0.25 }}>
                        <role.icon style={{ width: 18, height: 18 }} />
                      </motion.div>
                    </motion.div>
                    <AnimatePresence mode="wait">
                      {isActive ? (
                        <motion.div key="check" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                          <CheckCircle2 className={cn("h-5 w-5 shrink-0", role.checkColor)} />
                        </motion.div>
                      ) : (
                        <motion.div key="circle" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>
                          <div className="h-5 w-5 rounded-full border-2 border-border/50" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <motion.div className="relative text-sm font-bold leading-tight"
                    animate={{ color: isActive ? role.accent : "var(--foreground)" }} transition={{ duration: 0.22 }}>
                    {role.label}
                  </motion.div>
                  <div className="relative text-[11px] text-muted-foreground leading-tight mt-0.5">{role.desc}</div>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Form */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                {isTutor && requires2FA && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-2 text-primary font-semibold mb-1">
                        <ShieldCheck className="h-4 w-4" /> Двухфакторная проверка
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Мы отправили 6-значный код на {email}. Введите его ниже (действителен 10 минут).
                      </p>
                    </motion.div>
                    <motion.div className="space-y-1.5"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <label className="text-xs font-semibold text-foreground/60 uppercase tracking-wider" htmlFor="twofa-code">
                        Код из email
                      </label>
                      <FocusField icon={Lock} isTutor={isTutor}>
                        <Input id="twofa-code" inputMode="numeric" autoComplete="one-time-code"
                          maxLength={6} value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="000000"
                          className="pl-11 h-12 text-base tracking-[0.5em] text-center font-mono rounded-xl border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          required autoFocus data-testid="input-2fa-code" />
                      </FocusField>
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <button type="button" onClick={handleCancel2FA}
                          className="text-muted-foreground hover:text-foreground" data-testid="button-cancel-2fa">
                          ← Назад
                        </button>
                        <button type="button" onClick={handleResend2FA}
                          className="text-primary hover:text-primary/80" data-testid="button-resend-2fa">
                          Отправить код ещё раз
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
                {!(isTutor && requires2FA) && (
                <>
                <motion.div className="space-y-1.5"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
                  <label className="text-xs font-semibold text-foreground/60 uppercase tracking-wider" htmlFor="email">
                    {activeTab === "tutor" ? "Email" : "Логин"}
                  </label>
                  <FocusField icon={Mail} isTutor={isTutor}>
                    <Input id="email" type={activeTab === "tutor" ? "email" : "text"} value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={activeTab === "tutor" ? "tutor@example.com" : "логин или email"}
                      className="pl-11 h-12 text-sm rounded-xl border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                      required autoFocus data-testid="input-login-email" />
                  </FocusField>
                </motion.div>

                <motion.div className="space-y-1.5"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
                  <label className="text-xs font-semibold text-foreground/60 uppercase tracking-wider" htmlFor="password">
                    Пароль
                  </label>
                  <FocusField icon={Lock} isTutor={isTutor} right={
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors z-10"
                      tabIndex={-1} data-testid="button-toggle-password">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }>
                    <Input id="password" type={showPassword ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль"
                      className="pl-11 pr-11 h-12 text-sm rounded-xl border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                      required data-testid="input-login-password" />
                  </FocusField>
                </motion.div>
                </>
                )}

                <AnimatePresence>
                  {error && (
                    <motion.div initial={{ opacity: 0, height: 0, y: -4 }} animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
                      <ShakeBox>
                        <div className="flex items-center gap-2.5 rounded-xl bg-destructive/8 border border-destructive/15 px-4 py-3 text-sm text-destructive">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {error.message}
                        </div>
                      </ShakeBox>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
                  <AnimatedSubmitButton isTutor={isTutor} isLoading={isLoading} />
                </motion.div>

                {activeTab === "tutor" && (
                  <motion.div className="flex items-center justify-between pt-1"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}>
                    <a href="/register" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors" data-testid="link-to-register">
                      Создать аккаунт
                    </a>
                    <a href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-forgot-password">
                      Забыли пароль?
                    </a>
                  </motion.div>
                )}
                {activeTab === "student" && (
                  <motion.div className="flex flex-col items-center gap-1 pt-1"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}>
                    <p className="text-center text-[12px] text-muted-foreground">
                      Данные для входа предоставляет ваш репетитор
                    </p>
                    <a href="/student/forgot-password" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-student-forgot-password">
                      Забыли пароль?
                    </a>
                  </motion.div>
                )}
              </form>
            </motion.div>
          </AnimatePresence>

          {/* Demo credentials — показываем только в dev или при ?demo=1 в URL */}
          {(import.meta.env.DEV || (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1")) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className={cn("mt-5 rounded-xl border p-4 transition-colors duration-300",
              activeTab === "student" ? "border-violet-500/15 bg-violet-500/4" : "border-primary/15 bg-primary/4")}>
            <div className={cn("text-[11px] font-semibold uppercase tracking-wide mb-2",
              activeTab === "student" ? "text-violet-500/70" : "text-primary/70")}>Демо-доступ</div>
            {activeTab === "tutor" ? (
              <motion.button type="button" whileHover={{ x: 2 }} whileTap={{ scale: 0.99 }}
                className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer leading-relaxed"
                onClick={() => { setEmail("demo@vector.ru"); setPassword("demo123"); }}>
                <span className="font-semibold text-foreground/70">Репетитор:</span> demo@vector.ru / demo123
                <span className="ml-1 text-primary/50">(нажмите)</span>
              </motion.button>
            ) : (
              <motion.button type="button" whileHover={{ x: 2 }} whileTap={{ scale: 0.99 }}
                className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer leading-relaxed"
                onClick={() => { setEmail("student@vector.ru"); setPassword("student123"); }}>
                <span className="font-semibold text-foreground/70">Ученик:</span> student@vector.ru / student123
                <span className="ml-1 text-violet-500/50">(нажмите)</span>
              </motion.button>
            )}
          </motion.div>
          )}

          <motion.p className="mt-4 text-center text-[11px] text-muted-foreground/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
            Защищено шифрованием · Ваши данные в безопасности
          </motion.p>
        </div>
      </div>
    </div>
  );
}
