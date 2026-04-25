import { useState } from "react";
import { Plus, Clock, Target, BookOpen, Trash2, Edit, Copy, Globe } from "lucide-react";
import { toast } from "sonner";
import { invalidateResource } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLessonTemplates, useCreateTemplate, useDeleteTemplate } from "@/hooks/use-lesson-templates";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Student, Lesson } from "@shared/schema";

export function LessonTemplatesPanel() {
  const { data: templates, isLoading } = useLessonTemplates();
  const createMutation = useCreateTemplate();
  const deleteMutation = useDeleteTemplate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [useDialogOpen, setUseDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [useStudentId, setUseStudentId] = useState("");
  const [useDate, setUseDate] = useState("");
  const [useHour, setUseHour] = useState(10);

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/students"],
  });

  const activeStudents = students.filter((s) => s.isActive);

  const createLessonMutation = useMutation({
    mutationFn: async (data: Partial<Lesson>) => {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create lesson");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("lessons");
    },
  });

  const handleUseTemplate = async () => {
    if (!selectedTemplate || !useStudentId || !useDate) {
      toast.error("Выберите ученика и дату");
      return;
    }

    const scheduledAt = new Date(useDate);
    scheduledAt.setHours(useHour, 0, 0, 0);

    try {
      await createLessonMutation.mutateAsync({
        studentId: useStudentId,
        scheduledAt,
        durationMinutes: selectedTemplate.duration,
        topic: selectedTemplate.title,
        status: "pending",
      });
      toast.success("Занятие создано на основе шаблона");
      setUseDialogOpen(false);
      setSelectedTemplate(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const [form, setForm] = useState({
    title: "",
    subject: "",
    description: "",
    duration: 60,
    objectives: "",
    materials: "",
    isPublic: false,
  });

  const handleCreate = async () => {
    if (!form.title || !form.subject) {
      toast.error("Заполните название и предмет");
      return;
    }

    try {
      await createMutation.mutateAsync({
        title: form.title,
        subject: form.subject,
        description: form.description || undefined,
        duration: form.duration,
        objectives: form.objectives.split("\n").filter(Boolean),
        materials: form.materials.split("\n").filter(Boolean),
        isPublic: form.isPublic,
      });
      toast.success("Шаблон создан");
      setDialogOpen(false);
      setForm({
        title: "",
        subject: "",
        description: "",
        duration: 60,
        objectives: "",
        materials: "",
        isPublic: false,
      });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить шаблон?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Шаблон удалён");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Шаблоны занятий</h2>
          <p className="text-sm text-muted-foreground">
            Готовые планы уроков для быстрого создания занятий
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-template">
              <Plus className="h-4 w-4" />
              Создать шаблон
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Новый шаблон занятия</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Название</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Введение в алгебру"
                  />
                </div>
                <div>
                  <Label>Предмет</Label>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Математика"
                  />
                </div>
              </div>
              <div>
                <Label>Описание</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Краткое описание урока..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Длительность (минут)</Label>
                <Input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Цели урока (каждая с новой строки)</Label>
                <Textarea
                  value={form.objectives}
                  onChange={(e) => setForm({ ...form, objectives: e.target.value })}
                  placeholder="Понять основы алгебры&#10;Научиться решать уравнения"
                  rows={3}
                />
              </div>
              <div>
                <Label>Материалы (каждый с новой строки)</Label>
                <Textarea
                  value={form.materials}
                  onChange={(e) => setForm({ ...form, materials: e.target.value })}
                  placeholder="Учебник, стр. 15-20&#10;Рабочая тетрадь"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isPublic}
                  onCheckedChange={(checked) => setForm({ ...form, isPublic: checked })}
                />
                <Label>Сделать публичным (видно другим репетиторам)</Label>
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? <Spinner className="h-4 w-4" /> : "Создать"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!templates?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Нет шаблонов занятий</p>
            <p className="text-sm text-muted-foreground">
              Создайте первый шаблон для экономии времени
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="relative overflow-hidden">
              {template.isPublic && (
                <div className="absolute right-2 top-2">
                  <Badge variant="secondary" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Публичный
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{template.title}</CardTitle>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant="outline">{template.subject}</Badge>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {template.duration} мин
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {template.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                )}

                {template.objectives.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Target className="h-3 w-3" />
                      Цели:
                    </div>
                    <ul className="space-y-0.5">
                      {template.objectives.slice(0, 3).map((obj, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          • {obj}
                        </li>
                      ))}
                      {template.objectives.length > 3 && (
                        <li className="text-xs text-muted-foreground/70">
                          +{template.objectives.length - 3} ещё
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 gap-1"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setUseDate(new Date().toISOString().split("T")[0]);
                      setUseStudentId(activeStudents[0]?.id || "");
                      setUseDialogOpen(true);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    Использовать
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Use Template Dialog */}
      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Создать занятие по шаблону</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-border/70 bg-muted/50 p-3">
                <div className="font-medium">{selectedTemplate.title}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedTemplate.subject} • {selectedTemplate.duration} мин
                </div>
              </div>
              
              <div>
                <Label>Ученик</Label>
                <Select value={useStudentId} onValueChange={setUseStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите ученика" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} - {s.subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={useDate}
                  onChange={(e) => setUseDate(e.target.value)}
                />
              </div>

              <div>
                <Label>Время</Label>
                <Select value={String(useHour)} onValueChange={(v) => setUseHour(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 13 }, (_, i) => i + 9).map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                className="w-full" 
                onClick={handleUseTemplate}
                disabled={createLessonMutation.isPending}
              >
                Создать занятие
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
