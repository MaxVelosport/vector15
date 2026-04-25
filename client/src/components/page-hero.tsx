import { cn } from "@/lib/utils";

interface PageHeroProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  gradient: string;
  iconBg?: string;
  stats?: { label: string; value: string | number; icon?: React.ReactNode }[];
  badge?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHero({
  icon, title, subtitle, gradient, iconBg,
  stats, badge, children, className,
}: PageHeroProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border/40", className)}>
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-90", gradient)} />
      <div className="absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)`,
        backgroundSize: "20px 20px",
      }} />
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
      <div className="absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-black/10" />
      <div className="absolute right-1/4 bottom-0 h-20 w-20 rounded-full bg-white/5" />

      <div className="relative px-5 py-5">
        <div className="flex items-start gap-4">
          <div className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg",
            iconBg ?? "bg-white/20"
          )}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white leading-tight">{title}</h2>
              {badge && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white/90 uppercase tracking-wide">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-sm text-white/70 mt-0.5 leading-relaxed">{subtitle}</p>
          </div>
        </div>

        {stats && stats.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                {s.icon && <span className="text-white/60">{s.icon}</span>}
                <span className="text-xs font-bold text-white">{s.value}</span>
                <span className="text-[11px] text-white/60">{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}
