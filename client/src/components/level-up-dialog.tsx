import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Trophy, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVEL_INFO: Record<number, { emoji: string; title: string; subtitle: string; gradient: string; perks: string[] }> = {
  1: { emoji: "🌱", title: "Новичок",      subtitle: "Путь только начинается",    gradient: "from-slate-400 to-slate-600",  perks: ["Доступ к базовым урокам", "Персональный прогресс", "Первые бейджи"] },
  2: { emoji: "📘", title: "Старательный", subtitle: "Ты уже втянулся!",          gradient: "from-blue-400 to-blue-600",    perks: ["Статистика по неделям", "Серии ДЗ подряд", "Рейтинг среди учеников"] },
  3: { emoji: "🎯", title: "Прилежный",    subtitle: "Результаты говорят сами",   gradient: "from-green-400 to-emerald-600",perks: ["Продвинутые бейджи", "Отображение в топ-5 рейтинга", "Больше XP за оценки"] },
  4: { emoji: "🚀", title: "Продвинутый",  subtitle: "Серьёзный уровень!",         gradient: "from-violet-400 to-purple-600",perks: ["Открыты все категории бейджей", "Подиум в рейтинге", "Эксклюзивные достижения"] },
  5: { emoji: "💎", title: "Эксперт",      subtitle: "Мало кто доходит сюда",     gradient: "from-orange-400 to-red-500",   perks: ["Звание Эксперта", "Доступ к легендарным бейджам", "Особая отметка в профиле"] },
  6: { emoji: "👑", title: "Мастер",       subtitle: "Вершина прогресса!",         gradient: "from-amber-400 to-yellow-500", perks: ["Максимальный уровень", "Корона Мастера", "Легенда школы"] },
};

function Confetti({ count = 24 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => i);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map((i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const duration = 1.8 + Math.random() * 1.2;
        const rot = Math.random() * 360;
        const size = 6 + Math.random() * 8;
        const colors = ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#a855f7", "#ec4899"];
        const color = colors[i % colors.length];
        return (
          <motion.div
            key={i}
            className="absolute rounded-sm"
            style={{ left: `${left}%`, top: "-10%", width: size, height: size, background: color }}
            initial={{ y: 0, opacity: 1, rotate: 0 }}
            animate={{ y: "110vh", opacity: [1, 1, 0], rotate: rot + 720 }}
            transition={{ duration, delay, ease: "easeIn" }}
          />
        );
      })}
    </div>
  );
}

interface Props {
  studentId: string | number | null | undefined;
  currentLevel: number | null | undefined;
  currentLevelName?: string;
}

/**
 * Показывает диалог один раз, когда ученик впервые после повышения заходит на страницу прогресса.
 * Хранит последний виденный уровень в localStorage по ключу `student-level-seen:<studentId>`.
 */
export function LevelUpDialog({ studentId, currentLevel }: Props) {
  const [open, setOpen] = useState(false);
  const [shownLevel, setShownLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!studentId || !currentLevel) return;
    const key = `student-level-seen:${studentId}`;
    try {
      const raw = localStorage.getItem(key);
      const seen = raw ? parseInt(raw, 10) : 0;
      if (currentLevel > seen) {
        // Не показываем при самой первой установке (seen = 0) — только при реальном повышении
        if (seen > 0) {
          setShownLevel(currentLevel);
          setOpen(true);
        }
        localStorage.setItem(key, String(currentLevel));
      }
    } catch {
      // ignore
    }
  }, [studentId, currentLevel]);

  const info = shownLevel ? LEVEL_INFO[shownLevel] || LEVEL_INFO[1] : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0" data-testid="dialog-level-up">
        <AnimatePresence>
          {open && info && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative"
            >
              <Confetti />
              <div className={cn("bg-gradient-to-br text-white p-8 text-center relative", info.gradient)}>
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="flex items-center justify-center gap-1.5 text-sm font-bold uppercase tracking-wider text-white/90 mb-3"
                >
                  <Sparkles className="h-4 w-4" />
                  Новый уровень
                  <Sparkles className="h-4 w-4" />
                </motion.div>

                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
                  className="text-7xl mb-2"
                  data-testid="text-level-emoji"
                >
                  {info.emoji}
                </motion.div>

                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <p className="text-xs font-semibold text-white/80">УРОВЕНЬ {shownLevel}</p>
                  <h2 className="text-3xl font-black mt-1" data-testid="text-level-title">{info.title}</h2>
                  <p className="text-sm text-white/85 mt-1">{info.subtitle}</p>
                </motion.div>
              </div>

              <div className="bg-card p-6">
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  className="space-y-2.5"
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                    Что открылось
                  </p>
                  <ul className="space-y-1.5">
                    {info.perks.map((perk, i) => (
                      <motion.li
                        key={i}
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.7 + i * 0.08 }}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>{perk}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="mt-5"
                >
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => setOpen(false)}
                    data-testid="button-level-up-close"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Продолжить
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
