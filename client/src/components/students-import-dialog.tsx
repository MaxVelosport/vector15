import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Trash2, Download, Loader2 } from "lucide-react";
import { useCreateStudent } from "@/hooks/use-tutor-data";
import { useToast } from "@/hooks/use-toast";

type ImportRow = {
  name: string;
  subject: string;
  goal: string;
  grade: string;
  pricePerLesson: number;
  email?: string;
  parentContact?: string;
  parentLink?: string;
  comment?: string;
  _error?: string;
  _status?: "pending" | "ok" | "error";
};

const COLUMN_ALIASES: Record<keyof ImportRow, string[]> = {
  name: ["имя", "name", "фио", "ученик", "ф.и.о.", "ф.и.о", "ребёнок", "ребенок"],
  subject: ["предмет", "subject", "дисциплина"],
  goal: ["цель", "goal", "экзамен", "программа"],
  grade: ["класс", "grade", "курс", "уровень"],
  pricePerLesson: ["цена", "price", "стоимость", "ставка", "цена за урок", "price_per_lesson", "priceperlesson"],
  email: ["email", "почта", "e-mail", "емейл", "e_mail"],
  parentContact: ["телефон", "phone", "контакт родителя", "родитель", "parent", "parent_contact", "parentcontact"],
  parentLink: ["ссылка родителя", "telegram", "тг родителя", "parent_link", "parentlink"],
  comment: ["комментарий", "заметка", "note", "comment"],
  _error: [],
  _status: [],
};

function detectColumn(header: string): keyof ImportRow | null {
  const h = header.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [keyof ImportRow, string[]][]) {
    if (aliases.some(a => h === a || h.includes(a))) return field;
  }
  return null;
}

function parseRows(rows: any[][]): { rows: ImportRow[]; mapping: Record<number, keyof ImportRow | null> } {
  if (rows.length === 0) return { rows: [], mapping: {} };
  const header = rows[0].map(c => String(c ?? ""));
  const mapping: Record<number, keyof ImportRow | null> = {};
  header.forEach((h, i) => { mapping[i] = detectColumn(h); });

  const parsed: ImportRow[] = rows.slice(1)
    .filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ""))
    .map(r => {
      const obj: any = { name: "", subject: "Математика", goal: "Подготовка", grade: "10 класс", pricePerLesson: 1500 };
      Object.entries(mapping).forEach(([idx, field]) => {
        if (!field) return;
        const raw = r[Number(idx)];
        if (raw === null || raw === undefined || String(raw).trim() === "") return;
        if (field === "pricePerLesson") {
          const num = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
          if (!Number.isNaN(num) && num > 0) obj[field] = num;
        } else {
          obj[field] = String(raw).trim();
        }
      });
      return obj as ImportRow;
    });
  return { rows: parsed, mapping };
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Имя", "Предмет", "Цель", "Класс", "Цена за урок", "Email", "Телефон родителя", "Telegram родителя", "Комментарий"],
    ["Иванов Иван", "Математика", "ЕГЭ (профиль)", "11 класс", 1800, "ivan@example.com", "+7 999 123-45-67", "@ivan_parent", "Готовится к ЕГЭ"],
    ["Петрова Анна", "Русский язык", "ОГЭ", "9 класс", 1500, "anna@example.com", "+7 999 765-43-21", "", "Нужна работа над сочинением"],
  ]);
  ws["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ученики");
  XLSX.writeFile(wb, "Шаблон_импорта_учеников.xlsx");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (count: number) => void;
}

export function StudentsImportDialog({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [okCount, setOkCount] = useState(0);
  const [errCount, setErrCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const createStudent = useCreateStudent();
  const { toast } = useToast();

  const reset = () => {
    setStep("upload"); setRows([]); setFileName(""); setParseError(null);
    setProgress(0); setOkCount(0); setErrCount(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Файл не содержит листов");
      const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false, defval: "" });
      const { rows: parsed } = parseRows(aoa);
      if (parsed.length === 0) {
        setParseError("В файле не найдено строк с учениками. Убедитесь, что первая строка — заголовки колонок.");
        return;
      }
      setRows(parsed);
      setStep("preview");
    } catch (e: any) {
      setParseError(e.message || "Не удалось разобрать файл");
    }
  };

  const updateCell = (i: number, field: keyof ImportRow, value: string | number) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value, _error: undefined } : r));
  };
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const validate = (r: ImportRow): string | null => {
    if (!r.name?.trim()) return "Не указано имя";
    if (!r.subject?.trim()) return "Не указан предмет";
    if (!r.grade?.trim()) return "Не указан класс";
    if (!r.goal?.trim()) return "Не указана цель";
    if (!r.pricePerLesson || r.pricePerLesson <= 0) return "Цена должна быть больше 0";
    return null;
  };

  const handleImport = async () => {
    setStep("importing");
    setProgress(0); setOkCount(0); setErrCount(0);
    let ok = 0, err = 0;
    const updated = [...rows];
    for (let i = 0; i < updated.length; i++) {
      const r = updated[i];
      const validationError = validate(r);
      if (validationError) {
        updated[i] = { ...r, _status: "error", _error: validationError };
        err++;
      } else {
        try {
          await createStudent.mutateAsync({
            name: r.name.trim(),
            subject: r.subject.trim(),
            goal: r.goal.trim(),
            grade: r.grade.trim(),
            pricePerLesson: r.pricePerLesson,
            email: r.email?.trim() || null,
            parentContact: r.parentContact?.trim() || null,
            parentLink: r.parentLink?.trim() || null,
            comment: r.comment?.trim() || null,
          } as any);
          updated[i] = { ...r, _status: "ok" };
          ok++;
        } catch (e: any) {
          updated[i] = { ...r, _status: "error", _error: e.message || "Ошибка создания" };
          err++;
        }
      }
      setRows([...updated]);
      setOkCount(ok); setErrCount(err);
      setProgress(Math.round(((i + 1) / updated.length) * 100));
    }
    setStep("done");
    if (ok > 0) {
      toast({ title: `Импортировано: ${ok}`, description: err > 0 ? `Ошибок: ${err}` : "Все ученики добавлены" });
      onImported?.(ok);
    }
  };

  const allValid = rows.length > 0 && rows.every(r => validate(r) === null);

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && step === "importing") return; // защита от закрытия во время импорта
      if (!v) reset();
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-import-students">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            Импорт учеников из Excel или CSV
          </DialogTitle>
          <DialogDescription>
            Загрузите файл .xlsx или .csv. Колонки распознаются автоматически по заголовкам.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-2 px-2">
          {step === "upload" && (
            <div className="space-y-4 py-4">
              <div
                role="button"
                tabIndex={0}
                aria-label="Загрузить файл со списком учеников"
                className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:bg-accent/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => fileRef.current?.click()}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                data-testid="dropzone-students-import"
              >
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">Перетащите файл сюда или нажмите, чтобы выбрать</p>
                <p className="text-xs text-muted-foreground mt-1">Поддерживаются .xlsx, .xls, .csv</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  data-testid="input-import-file"
                />
              </div>
              {parseError && (
                <Alert variant="destructive">
                  <AlertDescription data-testid="text-parse-error">{parseError}</AlertDescription>
                </Alert>
              )}
              <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
                <p className="font-medium">Ожидаемые колонки (заголовки в первой строке):</p>
                <p className="text-muted-foreground text-xs">
                  Имя · Предмет · Цель · Класс · Цена за урок · Email · Телефон родителя · Telegram родителя · Комментарий
                </p>
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="mt-2" data-testid="button-download-template">
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Скачать шаблон Excel
                </Button>
              </div>
            </div>
          )}

          {(step === "preview" || step === "importing" || step === "done") && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Файл: <span className="font-medium text-foreground">{fileName}</span> · Строк: {rows.length}
                </span>
                {step === "done" && (
                  <span className="flex items-center gap-3">
                    <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> {okCount}</span>
                    {errCount > 0 && <span className="text-destructive flex items-center gap-1"><XCircle className="h-4 w-4" /> {errCount}</span>}
                  </span>
                )}
              </div>
              {step === "importing" && <Progress value={progress} className="h-2" />}

              <div className="border rounded-lg overflow-auto max-h-[55vh]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="min-w-[140px]">Имя*</TableHead>
                      <TableHead className="min-w-[110px]">Предмет*</TableHead>
                      <TableHead className="min-w-[120px]">Цель*</TableHead>
                      <TableHead className="min-w-[90px]">Класс*</TableHead>
                      <TableHead className="min-w-[80px]">Цена*</TableHead>
                      <TableHead className="min-w-[140px]">Email</TableHead>
                      <TableHead className="min-w-[120px]">Телефон</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => {
                      const err = r._error || validate(r);
                      return (
                        <TableRow key={i} className={r._status === "error" ? "bg-destructive/5" : r._status === "ok" ? "bg-emerald-500/5" : ""}>
                          <TableCell>
                            {r._status === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
                              r._status === "error" ? <XCircle className="h-4 w-4 text-destructive" /> :
                                err ? <span className="h-2 w-2 rounded-full bg-destructive inline-block" title={err} /> : null}
                          </TableCell>
                          <TableCell><Input value={r.name} onChange={e => updateCell(i, "name", e.target.value)} className="h-8 text-xs" disabled={step !== "preview"} data-testid={`input-import-name-${i}`} /></TableCell>
                          <TableCell><Input value={r.subject} onChange={e => updateCell(i, "subject", e.target.value)} className="h-8 text-xs" disabled={step !== "preview"} /></TableCell>
                          <TableCell><Input value={r.goal} onChange={e => updateCell(i, "goal", e.target.value)} className="h-8 text-xs" disabled={step !== "preview"} /></TableCell>
                          <TableCell><Input value={r.grade} onChange={e => updateCell(i, "grade", e.target.value)} className="h-8 text-xs" disabled={step !== "preview"} /></TableCell>
                          <TableCell><Input type="number" value={r.pricePerLesson} onChange={e => updateCell(i, "pricePerLesson", parseInt(e.target.value) || 0)} className="h-8 text-xs" disabled={step !== "preview"} /></TableCell>
                          <TableCell><Input value={r.email || ""} onChange={e => updateCell(i, "email", e.target.value)} className="h-8 text-xs" disabled={step !== "preview"} /></TableCell>
                          <TableCell><Input value={r.parentContact || ""} onChange={e => updateCell(i, "parentContact", e.target.value)} className="h-8 text-xs" disabled={step !== "preview"} /></TableCell>
                          <TableCell>
                            {step === "preview" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(i)} data-testid={`button-remove-row-${i}`}>
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {!allValid && step === "preview" && (
                <p className="text-xs text-destructive">Заполните все обязательные поля (отмечены *) перед импортом.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-3">
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>Назад</Button>
              <Button onClick={handleImport} disabled={!allValid} data-testid="button-confirm-import">
                <Upload className="h-4 w-4 mr-2" />
                Импортировать {rows.length} учеников
              </Button>
            </>
          )}
          {step === "importing" && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Импортируем... {progress}%
            </Button>
          )}
          {step === "done" && (
            <>
              {errCount > 0 && <Button variant="outline" onClick={() => setStep("preview")}>Исправить ошибки</Button>}
              <Button onClick={() => { reset(); onOpenChange(false); }} data-testid="button-close-import">Готово</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
