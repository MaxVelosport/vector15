import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, X, Users, Calendar, BookOpen,
  CircleDollarSign, Bot, Sparkles, GraduationCap, Trophy,
  FileText, CheckCircle2, Star, Zap, Video, Target,
  Flame, TrendingUp, MessageSquare, LibraryBig, ListChecks,
  PenLine, Award, Play, Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─────────── Mini visual mockups per slide ─────────── */
function WelcomeMockup() {
  return (
    <div className="relative w-full h-full flex flex-col gap-2 p-3 select-none">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-3 w-20 rounded-full bg-white/30" />
        <div className="h-3 w-12 rounded-full bg-white/20" />
      </div>
      {[["🔥 Серия", "14 дн", "orange"], ["⭐ Уровень 6", "580 XP", "yellow"], ["🏆 Веха", "20 ур.", "violet"], ["🏅 Месяц", "+38%", "green"]].map(([label, val, c], i) => (
        <motion.div key={i}
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + i * 0.1 }}
          className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
          <span className="text-xs text-white/80 font-medium">{label}</span>
          <span className="text-xs font-bold text-white">{val}</span>
        </motion.div>
      ))}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        className="mt-1 rounded-xl bg-white/15 p-3 text-center">
        <div className="text-[10px] text-white/60 mb-1">Ближайшее занятие</div>
        <div className="text-sm font-bold text-white">Сегодня, 15:00</div>
        <div className="text-[10px] text-white/70">Алиса · Математика</div>
      </motion.div>
    </div>
  );
}

function StudentsMockup() {
  const students = [
    { name: "Алиса К.", subj: "Математика", bal: "+2 400 ₽", color: "from-blue-400 to-cyan-400" },
    { name: "Иван М.", subj: "Физика", bal: "−1 200 ₽", color: "from-violet-400 to-purple-400" },
    { name: "Маша Т.", subj: "Химия", bal: "+800 ₽", color: "from-pink-400 to-rose-400" },
  ];
  return (
    <div className="flex flex-col gap-2 p-3 w-full h-full">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-3 w-16 rounded-full bg-white/20" />
        <div className="ml-auto h-6 w-20 rounded-lg bg-white/20 flex items-center justify-center">
          <span className="text-[10px] text-white/70">+ Добавить</span>
        </div>
      </div>
      {students.map((s, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.12 }}
          className="flex items-center gap-2 rounded-xl bg-white/10 p-2.5 backdrop-blur-sm">
          <div className={cn("h-8 w-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold shrink-0", s.color)}>
            {s.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{s.name}</div>
            <div className="text-[10px] text-white/60">{s.subj}</div>
          </div>
          <div className={cn("text-[10px] font-bold", s.bal.startsWith("+") ? "text-emerald-300" : "text-red-300")}>{s.bal}</div>
        </motion.div>
      ))}
    </div>
  );
}

function ScheduleMockup() {
  const slots = [
    { time: "09:00", name: "Иван М.", done: true },
    { time: "11:00", name: "Алиса К.", done: true },
    { time: "15:00", name: "Маша Т.", done: false, active: true },
    { time: "17:30", name: "Паша Г.", done: false },
  ];
  return (
    <div className="flex flex-col gap-1.5 p-3 w-full h-full">
      <div className="flex items-center gap-1 mb-1">
        {["Пн", "Вт", "Ср", "Чт", "Пт"].map((d, i) => (
          <div key={d} className={cn("flex-1 rounded-lg py-1 text-center text-[9px] font-semibold",
            i === 2 ? "bg-white/30 text-white" : "bg-white/10 text-white/60")}>{d}</div>
        ))}
      </div>
      {slots.map((s, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 + i * 0.1 }}
          className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs",
            s.active ? "bg-white/25 ring-1 ring-white/40" : "bg-white/10")}>
          <span className="text-white/60 text-[10px] w-8 shrink-0">{s.time}</span>
          <span className="text-white font-medium flex-1 truncate text-[10px]">{s.name}</span>
          {s.done && <CheckCircle2 className="h-3 w-3 text-emerald-300 shrink-0" />}
          {s.active && <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="h-2 w-2 rounded-full bg-white shrink-0" />}
        </motion.div>
      ))}
    </div>
  );
}

function HomeworkMockup() {
  const tasks = [
    { title: "Квадратные уравнения §5", student: "Алиса К.", status: "сдано", color: "text-emerald-300" },
    { title: "Законы Ньютона", student: "Иван М.", status: "проверить", color: "text-amber-300" },
    { title: "Интегралы #12–15", student: "Маша Т.", status: "активно", color: "text-blue-300" },
  ];
  return (
    <div className="flex flex-col gap-2 p-3 w-full h-full">
      <div className="flex items-center gap-1 mb-1">
        <ListChecks className="h-3.5 w-3.5 text-white/60" />
        <div className="h-2.5 w-20 rounded-full bg-white/20" />
        <div className="ml-auto h-5 w-16 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-[9px] text-white/60">Банк заданий</span>
        </div>
      </div>
      {tasks.map((t, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.12 }}
          className="rounded-xl bg-white/10 p-2.5">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] font-semibold text-white leading-tight flex-1">{t.title}</span>
            <span className={cn("text-[9px] font-bold shrink-0", t.color)}>{t.status}</span>
          </div>
          <div className="text-[9px] text-white/50 mt-0.5">{t.student}</div>
        </motion.div>
      ))}
    </div>
  );
}

function FinanceMockup() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      let n = 0;
      const iv = setInterval(() => { n += 3200; setCount(n); if (n >= 64000) clearInterval(iv); }, 30);
      return () => clearInterval(iv);
    }, 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex flex-col gap-2 p-3 w-full h-full">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
        className="rounded-xl bg-white/15 p-3 text-center">
        <div className="text-[10px] text-white/60 mb-0.5">Заработано за месяц</div>
        <div className="text-2xl font-black text-white">{count.toLocaleString("ru")} ₽</div>
        <div className="text-[10px] text-emerald-300 font-semibold">+18% vs прошлый</div>
      </motion.div>
      <div className="grid grid-cols-2 gap-1.5">
        {[["Поступило", "48 000 ₽", "text-blue-300"], ["Ожидает", "16 000 ₽", "text-amber-300"],
          ["Ученики", "12 чел.", "text-violet-300"], ["Долги", "0 ₽", "text-emerald-300"]].map(([l, v, c], i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.08 }}
            className="rounded-lg bg-white/10 p-2 text-center">
            <div className="text-[9px] text-white/50">{l}</div>
            <div className={cn("text-xs font-bold", c)}>{v}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AIMockup() {
  const [visibleMessages, setVisibleMessages] = useState(0);
  const messages = [
    { role: "user", text: "Придумай 3 задачи по квадратным уравнениям" },
    { role: "ai", text: "Конечно! Вот задачи разного уровня сложности..." },
    { role: "user", text: "Сделай программу обучения на 3 месяца" },
  ];
  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => { i++; setVisibleMessages(i); if (i >= messages.length) clearInterval(iv); }, 600);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="flex flex-col gap-2 p-3 w-full h-full">
      <div className="flex items-center gap-1.5 mb-1">
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center">
          <Bot className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="h-2.5 w-20 rounded-full bg-white/20" />
        <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 2 }}
          className="ml-auto flex items-center gap-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[9px] text-emerald-300">онлайн</span>
        </motion.div>
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        {messages.slice(0, visibleMessages).map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className={cn("rounded-xl px-2.5 py-1.5 text-[10px] leading-snug max-w-[85%]",
              m.role === "user" ? "self-end bg-white/20 text-white" : "self-start bg-white/10 text-white/80")}>
            {m.text}
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-1.5">
        <div className="h-2.5 w-24 rounded-full bg-white/20" />
        <div className="ml-auto h-5 w-5 rounded-lg bg-white/30 flex items-center justify-center">
          <ArrowRight className="h-2.5 w-2.5 text-white" />
        </div>
      </div>
    </div>
  );
}

function ConferencesMockup() {
  return (
    <div className="flex flex-col gap-2 p-3 w-full h-full">
      <div className="flex items-center gap-1.5 mb-1">
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
          className="rounded-full bg-blue-500/40 border border-blue-400/50 px-2.5 py-0.5 flex items-center gap-1">
          <Video className="h-3 w-3 text-blue-300" />
          <span className="text-[10px] text-blue-200 font-semibold">Конференции</span>
        </motion.div>
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
          className="rounded-full bg-violet-500/40 border border-violet-400/50 px-2.5 py-0.5 flex items-center gap-1">
          <PenLine className="h-3 w-3 text-violet-300" />
          <span className="text-[10px] text-violet-200 font-semibold">Доски</span>
        </motion.div>
      </div>
      {[["Алиса К.", "Комната 1", true], ["Иван М.", "Комната 2", false], ["Маша Т.", "Комната 3", false]].map(([name, room, active], i) => (
        <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + i * 0.12 }}
          className={cn("flex items-center gap-2 rounded-xl p-2.5", active ? "bg-white/20 ring-1 ring-white/30" : "bg-white/10")}>
          <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white",
            active ? "bg-blue-400" : "bg-white/20")}>{(name as string)[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-white truncate">{name as string}</div>
            <div className="text-[9px] text-white/50">{room as string}</div>
          </div>
          <div className={cn("h-5 w-14 rounded-lg flex items-center justify-center text-[9px] font-semibold",
            active ? "bg-blue-500/60 text-blue-100" : "bg-white/10 text-white/40")}>
            {active ? "▶ Войти" : "Создать"}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function KnowledgeMockup() {
  const tabs = ["Старт", "Гайд", "FAQ", "ИИ", "Поддержка"];
  const [active, setActive] = useState(3);
  useEffect(() => {
    const iv = setInterval(() => setActive(a => (a + 1) % tabs.length), 1200);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="flex flex-col gap-2 p-3 w-full h-full">
      <div className="flex gap-1 flex-wrap mb-1">
        {tabs.map((t, i) => (
          <motion.div key={t} animate={{ scale: active === i ? 1.05 : 1 }}
            className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold cursor-default transition-colors",
              active === i ? "bg-white/30 text-white" : "bg-white/10 text-white/50")}>
            {t}
          </motion.div>
        ))}
      </div>
      <div className="flex-1 rounded-xl bg-white/10 p-2.5 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center shrink-0">
            <Bot className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[9px] font-semibold text-white">ИИ-ассистент</span>
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
            className="ml-auto flex gap-0.5">
            {[0, 1, 2].map(i => <div key={i} className="h-1 w-1 rounded-full bg-white/60" />)}
          </motion.div>
        </div>
        {["Как добавить ученика?", "Как записать оплату?", "Как подключить ИИ?"].map((q, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.15 }}
            className="rounded-lg bg-white/10 px-2 py-1 text-[9px] text-white/70">{q}</motion.div>
        ))}
      </div>
    </div>
  );
}

function GamificationMockup() {
  const [xp, setXp] = useState(430);
  useEffect(() => {
    const iv = setInterval(() => setXp(x => Math.min(x + 5, 580)), 60);
    return () => clearInterval(iv);
  }, []);
  const pct = ((xp - 500) / 100) * 100;
  return (
    <div className="flex flex-col gap-2 p-3 w-full h-full">
      <div className="rounded-xl bg-white/15 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">Уровень 6</div>
            <div className="text-white/60 text-[10px]">{xp} / 600 XP</div>
          </div>
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2, delay: 1 }}
            className="ml-auto text-lg">🔥</motion.div>
        </div>
        <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
            animate={{ width: `${Math.max(0, Math.min(100, ((xp - 500) / 100) * 100))}%` }}
            transition={{ duration: 0.3 }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[["🔥", "14 дней", "Серия"], ["🏆", "Про", "Ранг"], ["⭐", "208", "Уроков"]].map(([emoji, val, label]) => (
          <div key={label as string} className="rounded-xl bg-white/10 p-2 text-center">
            <div className="text-base">{emoji as string}</div>
            <div className="text-white font-bold text-xs">{val as string}</div>
            <div className="text-white/50 text-[9px]">{label as string}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {["🎯 Первый урок", "📚 10 уроков", "💎 100 уроков"].map(a => (
          <div key={a} className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] text-white/70">{a}</div>
        ))}
      </div>
    </div>
  );
}

function DoneMockup({ role }: { role: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-3 w-full h-full">
      <motion.div
        animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="text-5xl">🎉</motion.div>
      <div className="text-center">
        <div className="text-white font-bold text-sm mb-1">{role === "student" ? "Готов к занятиям!" : "Кабинет настроен!"}</div>
        <div className="text-white/60 text-[10px] leading-relaxed">
          {role === "student"
            ? "Теперь ты знаешь всё. Удачи в учёбе!"
            : "Добавьте первого ученика и создайте занятие!"}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 w-full mt-1">
        {(role === "student"
          ? ["📅 Проверь расписание", "📝 Сдай домашку", "🤖 Спроси ИИ"]
          : ["👤 Добавить ученика", "📅 Создать занятие", "💰 Настроить цены"]
        ).map((s, i) => (
          <motion.div key={s} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.12 }}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-[10px] text-white/80">
            {s}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Step definitions ─────────── */
interface OnboardingStep {
  id: string;
  bgGradient: string;
  accentColor: string;
  tag: string;
  tagIcon: React.ReactNode;
  title: string;
  subtitle: string;
  features: { icon: React.ReactNode; text: string; highlight?: string }[];
  mockup: React.ReactNode;
}

const TUTOR_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    bgGradient: "from-blue-600 via-indigo-600 to-violet-600",
    accentColor: "text-blue-200",
    tag: "Добро пожаловать",
    tagIcon: <Sparkles className="h-3 w-3" />,
    title: "ТВОЙ ВЕКТОР — ваш личный кабинет репетитора",
    subtitle: "Всё для профессиональной работы: ученики, расписание, финансы, ИИ и гейм-система — в одном месте.",
    features: [
      { icon: <Users className="h-3.5 w-3.5" />, text: "Ученики, прогресс и программы обучения" },
      { icon: <Calendar className="h-3.5 w-3.5" />, text: "Расписание занятий и история уроков" },
      { icon: <Trophy className="h-3.5 w-3.5" />, text: "XP, уровни и серии — геймификация занятий", highlight: "Новое" },
    ],
    mockup: <WelcomeMockup />,
  },
  {
    id: "students",
    bgGradient: "from-cyan-500 via-blue-500 to-blue-600",
    accentColor: "text-cyan-200",
    tag: "Ученики",
    tagIcon: <Users className="h-3 w-3" />,
    title: "Все ваши ученики в одном месте",
    subtitle: "Карточка каждого ученика — полное досье: прогресс, баланс, программа и контакты.",
    features: [
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Добавьте ученика — имя, предмет, цена за урок" },
      { icon: <Bot className="h-3.5 w-3.5" />, text: "ИИ создаст программу обучения за 10 секунд" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Лимит 40 учеников на тарифе Про (+доп. слоты)" },
    ],
    mockup: <StudentsMockup />,
  },
  {
    id: "schedule",
    bgGradient: "from-emerald-500 via-teal-500 to-cyan-600",
    accentColor: "text-emerald-200",
    tag: "Расписание",
    tagIcon: <Calendar className="h-3 w-3" />,
    title: "Умное расписание занятий",
    subtitle: "Планируйте уроки, отмечайте посещаемость и работайте с оценками прямо в календаре.",
    features: [
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Разовые и повторяющиеся занятия" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "После урока — оценка и отметка посещения" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Массовый перенос на каникулы одной кнопкой" },
    ],
    mockup: <ScheduleMockup />,
  },
  {
    id: "homework",
    bgGradient: "from-violet-500 via-purple-500 to-indigo-600",
    accentColor: "text-violet-200",
    tag: "Домашние задания + Банк",
    tagIcon: <ListChecks className="h-3 w-3" />,
    title: "Задавайте домашку и стройте банк заданий",
    subtitle: "Назначайте задания, устанавливайте дедлайны, создавайте библиотеку задач для повторного использования.",
    features: [
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Задание прямо из расписания — одним кликом" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Банк заданий — сохраняйте и переиспользуйте", highlight: "Новое" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "За проверенное задание ученик получает XP" },
    ],
    mockup: <HomeworkMockup />,
  },
  {
    id: "finance",
    bgGradient: "from-amber-500 via-orange-500 to-red-500",
    accentColor: "text-amber-200",
    tag: "Финансы",
    tagIcon: <CircleDollarSign className="h-3 w-3" />,
    title: "Контролируйте оплаты без Excel",
    subtitle: "Баланс учеников, история платежей и анализ дохода — всё автоматически в реальном времени.",
    features: [
      { icon: <TrendingUp className="h-3.5 w-3.5" />, text: "Динамика дохода: месяц к месяцу" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Баланс пересчитывается после каждого занятия" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Кто и сколько должен — с одного экрана" },
    ],
    mockup: <FinanceMockup />,
  },
  {
    id: "conferences",
    bgGradient: "from-blue-500 via-cyan-500 to-teal-500",
    accentColor: "text-cyan-200",
    tag: "Конференции и доски",
    tagIcon: <Video className="h-3 w-3" />,
    title: "Проводите онлайн-уроки прямо из кабинета",
    subtitle: "Кнопки «Конференции» и «Доски» в шапке — у каждого ученика своя постоянная комната BigBlueButton.",
    features: [
      { icon: <Video className="h-3.5 w-3.5" />, text: "Конференции — BigBlueButton с вашей комнатой", highlight: "Новое" },
      { icon: <PenLine className="h-3.5 w-3.5" />, text: "Интерактивная доска для совместной работы", highlight: "Новое" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Ученик подключается без регистрации по ссылке" },
    ],
    mockup: <ConferencesMockup />,
  },
  {
    id: "ai",
    bgGradient: "from-pink-500 via-rose-500 to-purple-600",
    accentColor: "text-pink-200",
    tag: "ИИ + База знаний",
    tagIcon: <Bot className="h-3 w-3" />,
    title: "ИИ-помощник и база знаний всегда рядом",
    subtitle: "Генерация программ, заданий и объяснений — ИИ берёт рутину на себя. База знаний с живым чатом.",
    features: [
      { icon: <Bot className="h-3.5 w-3.5" />, text: "Генерация программы обучения за 10 секунд" },
      { icon: <LibraryBig className="h-3.5 w-3.5" />, text: "База знаний → ИИ-ассистент ответит на вопрос", highlight: "Новое" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "GPT-4o, GPT-4o mini и DeepSeek на выбор" },
    ],
    mockup: <AIMockup />,
  },
  {
    id: "gamification",
    bgGradient: "from-amber-400 via-orange-500 to-red-500",
    accentColor: "text-amber-200",
    tag: "Геймификация",
    tagIcon: <Trophy className="h-3 w-3" />,
    title: "XP, уровни и серии — мотивация каждый день",
    subtitle: "Ученики зарабатывают опыт, прокачивают уровни и не хотят прерывать серию занятий.",
    features: [
      { icon: <Zap className="h-3.5 w-3.5" />, text: "1 занятие = 10 XP, каждые 100 XP = новый уровень", highlight: "Новое" },
      { icon: <Flame className="h-3.5 w-3.5" />, text: "Серия дней — мотивация не пропускать уроки", highlight: "Новое" },
      { icon: <Award className="h-3.5 w-3.5" />, text: "Вехи: 10, 25, 50, 100, 200, 500 уроков", highlight: "Новое" },
    ],
    mockup: <GamificationMockup />,
  },
  {
    id: "done",
    bgGradient: "from-blue-600 via-indigo-600 to-violet-600",
    accentColor: "text-blue-200",
    tag: "Всё готово!",
    tagIcon: <Star className="h-3 w-3" />,
    title: "Начните с добавления ученика",
    subtitle: "Вы готовы к работе. Первый шаг — добавьте ученика и создайте занятие. Успехов!",
    features: [
      { icon: <Star className="h-3.5 w-3.5" />, text: "«Ученики» → «Добавить ученика»" },
      { icon: <Star className="h-3.5 w-3.5" />, text: "«?» в любом разделе — подсказки по функциям" },
      { icon: <Star className="h-3.5 w-3.5" />, text: "Вернуть этот тур: кнопка «Обучение» на главной" },
    ],
    mockup: <DoneMockup role="tutor" />,
  },
];

const STUDENT_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    bgGradient: "from-violet-600 via-purple-600 to-indigo-600",
    accentColor: "text-violet-200",
    tag: "Привет!",
    tagIcon: <Sparkles className="h-3 w-3" />,
    title: "Добро пожаловать в твой учебный кабинет",
    subtitle: "Занятия, домашка, ИИ-помощник и своя система прогресса — всё здесь!",
    features: [
      { icon: <Calendar className="h-3.5 w-3.5" />, text: "Расписание занятий с репетитором" },
      { icon: <FileText className="h-3.5 w-3.5" />, text: "Домашние задания и дедлайны" },
      { icon: <Trophy className="h-3.5 w-3.5" />, text: "Уровни, XP и серии занятий", highlight: "Новое" },
    ],
    mockup: <WelcomeMockup />,
  },
  {
    id: "home",
    bgGradient: "from-cyan-500 via-blue-500 to-indigo-600",
    accentColor: "text-cyan-200",
    tag: "Главная страница",
    tagIcon: <Target className="h-3 w-3" />,
    title: "Твой персональный дашборд",
    subtitle: "Всё самое важное сразу: ближайший урок, серия занятий, твой уровень и прогресс.",
    features: [
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Кнопка «Войти в конференцию» в день занятия" },
      { icon: <Flame className="h-3.5 w-3.5" />, text: "Серия дней и уровень XP на главном экране", highlight: "Новое" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Предстоящие задания с дедлайном" },
    ],
    mockup: <ScheduleMockup />,
  },
  {
    id: "homework",
    bgGradient: "from-violet-500 via-purple-600 to-indigo-600",
    accentColor: "text-violet-200",
    tag: "Домашние задания",
    tagIcon: <FileText className="h-3 w-3" />,
    title: "Задания и сроки — всё под контролем",
    subtitle: "Репетитор задаёт домашку прямо в системе. Ты видишь задание, срок и можешь отметить выполнение.",
    features: [
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Все задания с дедлайнами — на одном экране" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Нажми «Сдано» — репетитор видит и оценивает" },
      { icon: <Zap className="h-3.5 w-3.5" />, text: "За выполненное задание получаешь +10 XP" },
    ],
    mockup: <HomeworkMockup />,
  },
  {
    id: "gamification",
    bgGradient: "from-amber-500 via-orange-500 to-yellow-500",
    accentColor: "text-amber-200",
    tag: "Мой прогресс",
    tagIcon: <Trophy className="h-3 w-3" />,
    title: "Прокачивай уровень и зарабатывай награды",
    subtitle: "Система уровней и серий делает учёбу интереснее. Зарабатывай XP за каждое занятие!",
    features: [
      { icon: <Zap className="h-3.5 w-3.5" />, text: "10 XP за каждое занятие, 100 XP = новый уровень", highlight: "Новое" },
      { icon: <Flame className="h-3.5 w-3.5" />, text: "Серия — сколько дней подряд ты занимаешься", highlight: "Новое" },
      { icon: <Award className="h-3.5 w-3.5" />, text: "Вехи за 10, 25, 50, 100+ уроков", highlight: "Новое" },
    ],
    mockup: <GamificationMockup />,
  },
  {
    id: "ai",
    bgGradient: "from-pink-500 via-rose-500 to-purple-600",
    accentColor: "text-pink-200",
    tag: "ИИ-помощник",
    tagIcon: <Bot className="h-3 w-3" />,
    title: "Застрял — спроси ИИ в любое время!",
    subtitle: "В разделе «ИИ-помощник» объяснение темы, разбор задачи или примеры — мгновенно.",
    features: [
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Объяснение любой темы простым языком" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Разбор задач шаг за шагом с формулами" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "Работает 24/7 — не нужно ждать урока" },
    ],
    mockup: <AIMockup />,
  },
  {
    id: "lessons",
    bgGradient: "from-emerald-500 via-teal-500 to-cyan-600",
    accentColor: "text-emerald-200",
    tag: "Занятия и конференции",
    tagIcon: <Video className="h-3 w-3" />,
    title: "Подключайся к уроку прямо из кабинета",
    subtitle: "Репетитор настраивает конференцию — кнопка подключения и доска появляются автоматически.",
    features: [
      { icon: <Video className="h-3.5 w-3.5" />, text: "Кнопка «Войти» в BigBlueButton прямо на главной", highlight: "Новое" },
      { icon: <PenLine className="h-3.5 w-3.5" />, text: "Интерактивная доска для совместной работы", highlight: "Новое" },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, text: "История посещений — всегда под рукой" },
    ],
    mockup: <ConferencesMockup />,
  },
  {
    id: "knowledge",
    bgGradient: "from-indigo-500 via-violet-500 to-purple-600",
    accentColor: "text-violet-200",
    tag: "База знаний",
    tagIcon: <LibraryBig className="h-3 w-3" />,
    title: "База знаний и ИИ-поддержка по платформе",
    subtitle: "В боковом меню есть «База знаний» — гайды, FAQ и живой ИИ-ассистент по работе с кабинетом.",
    features: [
      { icon: <BookOpen className="h-3.5 w-3.5" />, text: "Гайды и быстрый старт по всем функциям", highlight: "Новое" },
      { icon: <Bot className="h-3.5 w-3.5" />, text: "Спроси ИИ о платформе — ответит мгновенно", highlight: "Новое" },
      { icon: <MessageSquare className="h-3.5 w-3.5" />, text: "Поддержка и обратная связь в одном месте" },
    ],
    mockup: <KnowledgeMockup />,
  },
  {
    id: "done",
    bgGradient: "from-violet-600 via-purple-600 to-indigo-600",
    accentColor: "text-violet-200",
    tag: "Готово!",
    tagIcon: <Star className="h-3 w-3" />,
    title: "Ты готов к занятиям!",
    subtitle: "Теперь ты знаешь всё. Удачи в учёбе и пусть серия не прерывается! 🔥",
    features: [
      { icon: <Star className="h-3.5 w-3.5" />, text: "Загляни в «Прогресс» — посмотри свой уровень" },
      { icon: <Star className="h-3.5 w-3.5" />, text: "Проверь «Домашние задания» — нет ли активных" },
      { icon: <Star className="h-3.5 w-3.5" />, text: "Вернуть этот тур: кнопка «Справка» в меню" },
    ],
    mockup: <DoneMockup role="student" />,
  },
];

/* ─────────── Main component ─────────── */
interface OnboardingTourProps {
  onComplete: () => void;
  isOpen: boolean;
  role?: "tutor" | "student";
}

export function OnboardingTour({ onComplete, isOpen, role = "tutor" }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const steps = role === "student" ? STUDENT_STEPS : TUTOR_STEPS;

  useEffect(() => {
    if (isOpen) setCurrentStep(0);
  }, [isOpen]);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = useCallback(() => {
    if (!isLastStep) { setDirection(1); setCurrentStep(s => s + 1); }
    else onComplete();
  }, [isLastStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) { setDirection(-1); setCurrentStep(s => s - 1); }
  }, [currentStep]);

  const handleSkip = useCallback(() => onComplete(), [onComplete]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") handleSkip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, handleNext, handlePrev, handleSkip]);

  if (!isOpen) return null;

  const slideVariants = {
    enter: (d: number) => ({ opacity: 0, x: d * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d * -40 }),
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) handleSkip(); }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-3xl shadow-2xl bg-card border border-border/50"
          onClick={(e) => e.stopPropagation()}
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="flex flex-col md:flex-row"
            >
              {/* ── Left: visual mockup ── */}
              <div className={cn("relative overflow-hidden md:w-52 shrink-0 min-h-[200px] md:min-h-0 bg-gradient-to-br", step.bgGradient)}>
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)`,
                  backgroundSize: '20px 20px',
                }} />
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-28 h-28 bg-black/10 rounded-full translate-y-1/3 -translate-x-1/3" />
                <div className="relative h-full w-full flex items-center justify-center">
                  {step.mockup}
                </div>
              </div>

              {/* ── Right: content ── */}
              <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                  <div className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-gradient-to-r text-white", step.bgGradient)}>
                    {step.tagIcon}
                    {step.tag}
                  </div>
                  <button
                    onClick={handleSkip}
                    className="text-muted-foreground hover:text-foreground transition-colors rounded-full p-1.5 hover:bg-muted"
                    data-testid="button-onboarding-skip"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Title + subtitle */}
                <div className="px-6 pb-4">
                  <h2 className="text-base font-bold text-foreground leading-tight mb-1.5">{step.title}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.subtitle}</p>
                </div>

                {/* Features */}
                <div className="px-6 space-y-2.5 flex-1">
                  {step.features.map((feat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 + i * 0.07 }}
                      className="flex items-center gap-3"
                    >
                      <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white", step.bgGradient)}>
                        {feat.icon}
                      </div>
                      <p className="text-sm text-foreground/80 leading-snug flex-1">{feat.text}</p>
                      {feat.highlight && (
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white bg-gradient-to-r", step.bgGradient)}>
                          {feat.highlight}
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-6 pt-4 pb-5 mt-2">
                  {/* Progress bar */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full bg-gradient-to-r", step.bgGradient)}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 font-medium">
                      {currentStep + 1} / {steps.length}
                    </span>
                  </div>

                  {/* Dot nav */}
                  <div className="flex justify-center gap-1.5 mb-3">
                    {steps.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setDirection(idx > currentStep ? 1 : -1); setCurrentStep(idx); }}
                        className={cn(
                          "rounded-full transition-all duration-300",
                          idx === currentStep ? "w-5 h-1.5 bg-primary" :
                          idx < currentStep ? "w-1.5 h-1.5 bg-primary/40" :
                          "w-1.5 h-1.5 bg-muted-foreground/25"
                        )}
                      />
                    ))}
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2.5">
                    {currentStep > 0 ? (
                      <Button variant="outline" size="sm" className="gap-1.5 px-4" onClick={handlePrev}
                        data-testid="button-onboarding-prev">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Назад
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="px-4 text-muted-foreground" onClick={handleSkip}>
                        Пропустить
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className={cn("flex-1 gap-2 font-semibold bg-gradient-to-r text-white border-0 hover:opacity-90 transition-opacity shadow-lg", step.bgGradient)}
                      onClick={handleNext}
                      data-testid="button-onboarding-next"
                    >
                      {isLastStep ? "Начать работу" : "Далее"}
                      {!isLastStep && <ArrowRight className="h-4 w-4" />}
                      {isLastStep && <Sparkles className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Keyboard hint */}
                  <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] text-muted-foreground/50">
                    <Keyboard className="h-3 w-3" />
                    <span>← → Enter Esc</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─────────── Hook ─────────── */
export function useOnboarding(role: "tutor" | "student" = "tutor") {
  const key = `onboarding_completed_${role}_v3`;
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(key);
    if (!seen) {
      const timer = setTimeout(() => setShowOnboarding(true), 700);
      return () => clearTimeout(timer);
    }
  }, [key]);

  // Внешний триггер от Welcome-модалки
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(key);
      setShowOnboarding(true);
    };
    window.addEventListener("trigger-onboarding-tour", handler);
    return () => window.removeEventListener("trigger-onboarding-tour", handler);
  }, [key]);

  const completeOnboarding = () => {
    localStorage.setItem(key, "true");
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(key);
    setShowOnboarding(true);
  };

  return { showOnboarding, completeOnboarding, resetOnboarding };
}
