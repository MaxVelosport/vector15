import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  LayoutGrid,
  Trash2,
  ExternalLink,
  Plus,
  Clock,
  Info,
  Loader2,
  BookOpen,
  Sparkles,
  Link2,
  Search,
  ArrowDownAZ,
  ArrowUpAZ,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/lib/toast";

import { useDocumentTitle } from "@/hooks/use-document-title";
interface BoardEntry {
  id: string;
  name: string;
  subject: string;
  hasData: boolean;
  updatedAt: string | null;
}

interface TempBoard {
  tempId: string;
  boardUrl: string;
}

function formatUpdated(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "d MMM HH:mm", { locale: ru });
  } catch {
    return "—";
  }
}

export default function BoardsPage() {
  useDocumentTitle("Доски");
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [tempBoards, setTempBoards] = useState<TempBoard[]>([]);
  const [creatingTemp, setCreatingTemp] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAZ, setSortAZ] = useState(true);

  const { data: boards = [], isLoading } = useQuery<BoardEntry[]>({
    queryKey: ["/api/boards"],
  });

  useEffect(() => {
    if (location.includes("create=1")) {
      setLocation("/boards", { replace: true });
      handleCreateTemp();
    }
  }, []);

  const clearBoardMutation = useMutation({
    mutationFn: (studentId: string) =>
      apiRequest("DELETE", `/api/boards/${studentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      toast.success("Доска очищена");
    },
    onError: () => {
      toast.error("Ошибка", { description: "Не удалось очистить доску" });
    },
  });

  const handleCreateTemp = async () => {
    setCreatingTemp(true);
    try {
      const res = await apiRequest("POST", "/api/boards/temp");
      const data = await res.json();
      setTempBoards((prev) => [...prev, data]);
      toast.success("Временная доска создана", { description: "Ссылка готова к использованию"  });
    } catch {
      toast.error("Ошибка", { description: "Не удалось создать временную доску" });
    } finally {
      setCreatingTemp(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = boards
    .filter((b) => !q || b.name.toLowerCase().includes(q) || (b.subject || "").toLowerCase().includes(q))
    .sort((a, b) => sortAZ ? a.name.localeCompare(b.name, "ru") : b.name.localeCompare(a.name, "ru"));

  const withData = filtered.filter((b) => b.hasData);
  const empty = filtered.filter((b) => !b.hasData);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Доски</h1>
            <p className="text-muted-foreground mt-1">
              Совместные рабочие пространства с учениками в реальном времени
            </p>
          </div>
          <Button
            className="gap-2"
            onClick={handleCreateTemp}
            disabled={creatingTemp}
            data-testid="button-create-temp-board"
          >
            {creatingTemp ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Временная доска
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-violet-500/5 border border-violet-500/10 px-4 py-2.5">
          <Info className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Каждый ученик автоматически получает свою постоянную доску — данные сохраняются между занятиями.
            Временная доска не сохраняется и очищается автоматически через 30 минут после того, как все покинули комнату.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Поиск по имени или предмету..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search-boards"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 shrink-0"
            onClick={() => setSortAZ((v) => !v)}
            data-testid="button-sort-boards"
            title={sortAZ ? "А → Я" : "Я → А"}
          >
            {sortAZ ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
            <span className="hidden sm:inline">{sortAZ ? "А → Я" : "Я → А"}</span>
          </Button>
        </div>

        {tempBoards.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Временные доски</p>
            {tempBoards.map((tb) => (
              <Card key={tb.tempId} className="rounded-xl border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Временная доска</p>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{tb.tempId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs border-amber-500/30"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin + tb.boardUrl);
                        toast.success("Ссылка скопирована");
                      }}
                      data-testid={`button-copy-temp-${tb.tempId}`}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Скопировать ссылку
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600"
                      onClick={() => setLocation(tb.boardUrl)}
                      data-testid={`button-open-temp-${tb.tempId}`}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Открыть
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : boards.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-12 flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">Учеников нет</p>
                <p className="text-muted-foreground text-sm mt-1">Добавьте ученика — и его доска появится здесь</p>
              </div>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Search className="h-8 w-8 opacity-30" />
            <p className="text-sm">Ничего не найдено по запросу «{search}»</p>
          </div>
        ) : (
          <div className="space-y-4">
            {withData.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  С данными ({withData.length})
                </p>
                <div className="space-y-2">
                  {withData.map((board) => (
                    <BoardRow
                      key={board.id}
                      board={board}
                      onOpen={() => setLocation(`/board/${board.id}`)}
                      onClear={() => clearBoardMutation.mutate(board.id)}
                      isClearing={clearBoardMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {empty.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Пустые ({empty.length})
                </p>
                <div className="space-y-2">
                  {empty.map((board) => (
                    <BoardRow
                      key={board.id}
                      board={board}
                      onOpen={() => setLocation(`/board/${board.id}`)}
                      onClear={() => clearBoardMutation.mutate(board.id)}
                      isClearing={clearBoardMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function BoardRow({
  board,
  onOpen,
  onClear,
  isClearing,
}: {
  board: BoardEntry;
  onOpen: () => void;
  onClear: () => void;
  isClearing: boolean;
}) {
  return (
    <Card className={cn("rounded-xl transition-shadow hover:shadow-sm", board.hasData ? "border-violet-500/20" : "border-border/50")}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          board.hasData ? "bg-violet-500/15" : "bg-muted"
        )}>
          <LayoutGrid className={cn("h-4 w-4", board.hasData ? "text-violet-500" : "text-muted-foreground")} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{board.name}</p>
            {board.hasData ? (
              <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-600 bg-violet-500/5 shrink-0">
                есть данные
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
                пустая
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-muted-foreground truncate">{board.subject || "—"}</p>
            {board.updatedAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                {formatUpdated(board.updatedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {board.hasData && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  disabled={isClearing}
                  data-testid={`button-clear-board-${board.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Очистить доску?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Всё содержимое доски ученика «{board.name}» будет удалено без возможности восстановления.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={onClear} className="bg-destructive hover:bg-destructive/90">
                    Очистить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "gap-1.5 text-xs",
              board.hasData ? "border-violet-500/30 text-violet-700 hover:bg-violet-500/5" : ""
            )}
            onClick={onOpen}
            data-testid={`button-open-board-${board.id}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Открыть
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
