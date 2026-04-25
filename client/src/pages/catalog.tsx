import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { GraduationCap, Search, ArrowRight } from "lucide-react";

import { useDocumentTitle } from "@/hooks/use-document-title";
interface CatalogTutor {
  slug: string;
  name: string;
  subjects: string[];
  basePrice: number | null;
  bio: string;
  experience: string | null;
  education: string | null;
  color: string;
  avatar: string | null;
}

const GRADIENT_BY_COLOR: Record<string, string> = {
  violet: "from-violet-600 via-purple-600 to-indigo-700",
  blue: "from-blue-600 via-blue-700 to-indigo-700",
  emerald: "from-emerald-500 via-teal-600 to-cyan-700",
  rose: "from-rose-500 via-pink-600 to-fuchsia-700",
  amber: "from-amber-500 via-orange-600 to-red-700",
  slate: "from-slate-600 via-slate-700 to-slate-900",
};

function moneyRub(v: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(v);
}

export default function CatalogPage() {
  useDocumentTitle("Каталог репетиторов");
  const [tutors, setTutors] = useState<CatalogTutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/public/catalog")
      .then(r => r.json())
      .then(d => { setTutors(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tutors;
    return tutors.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.subjects.some(s => s.toLowerCase().includes(q)) ||
      (t.bio || "").toLowerCase().includes(q)
    );
  }, [tutors, query]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white">
        <div className="mx-auto max-w-5xl px-4 py-12 md:py-16 text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-catalog-title">
            Найдите своего репетитора
          </h1>
          <p className="mt-3 text-white/85 text-sm md:text-base max-w-xl mx-auto">
            Каталог преподавателей платформы «Твой Вектор». Отправьте заявку — и начните заниматься.
          </p>
          <div className="mt-6 mx-auto max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
            <Input
              placeholder="Поиск по предмету или имени"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-white/15 border-white/25 text-white placeholder:text-white/60 focus-visible:ring-white/40"
              data-testid="input-catalog-search"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground" data-testid="text-catalog-empty">
            <GraduationCap className="mx-auto h-12 w-12 mb-3 text-muted-foreground/40" />
            {tutors.length === 0
              ? "Скоро здесь появятся репетиторы."
              : "По вашему запросу ничего не найдено."}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => {
              const gradient = GRADIENT_BY_COLOR[t.color] || GRADIENT_BY_COLOR.violet;
              const initials = t.name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() || "?";
              return (
                <Link key={t.slug} href={`/t/${t.slug}`} data-testid={`card-tutor-${t.slug}`}>
                  <Card className="h-full rounded-2xl border-border/60 bg-card/70 backdrop-blur overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all active:scale-[0.99] hover-elevate">
                    <div className={`h-20 bg-gradient-to-br ${gradient} relative`}>
                      <div className="absolute -bottom-8 left-5 h-16 w-16 rounded-full bg-white/20 backdrop-blur border-2 border-card flex items-center justify-center overflow-hidden">
                        {t.avatar ? (
                          <img src={t.avatar} alt={t.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-white">{initials}</span>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-5 pt-10">
                      <h3 className="font-semibold text-base truncate" data-testid={`text-tutor-name-${t.slug}`}>{t.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.subjects.slice(0, 3).map((s, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                        {t.subjects.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{t.subjects.length - 3}</Badge>
                        )}
                      </div>
                      {t.bio && (
                        <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{t.bio}</p>
                      )}
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-sm font-semibold" data-testid={`text-tutor-price-${t.slug}`}>
                          {t.basePrice != null ? moneyRub(t.basePrice) : "Цена по запросу"}
                        </span>
                        <span className="text-xs text-primary flex items-center gap-1 font-medium">
                          Подробнее <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="py-6 text-center text-xs text-muted-foreground/70">
        Платформа{" "}
        <a href="/" className="font-semibold text-muted-foreground hover:text-foreground transition-colors">
          Твой Вектор
        </a>
      </div>
    </div>
  );
}
