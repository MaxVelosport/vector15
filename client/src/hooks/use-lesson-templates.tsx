import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Activity {
  title: string;
  duration: number;
  description?: string;
}

interface LessonTemplate {
  id: string;
  tutorId: string;
  title: string;
  subject: string;
  description: string | null;
  duration: number;
  objectives: string[];
  materials: string[];
  activities: Activity[];
  isPublic: boolean;
  createdAt: string;
}

interface CreateTemplateData {
  title: string;
  subject: string;
  description?: string;
  duration?: number;
  objectives?: string[];
  materials?: string[];
  activities?: Activity[];
  isPublic?: boolean;
}

export function useLessonTemplates() {
  return useQuery<LessonTemplate[]>({
    queryKey: ["/api/lesson-templates"],
    queryFn: async () => {
      const res = await fetch("/api/lesson-templates", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки шаблонов");
      return res.json();
    },
  });
}

export function usePublicTemplates() {
  return useQuery<LessonTemplate[]>({
    queryKey: ["/api/lesson-templates/public"],
    queryFn: async () => {
      const res = await fetch("/api/lesson-templates/public", { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки шаблонов");
      return res.json();
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTemplateData) => {
      const res = await fetch("/api/lesson-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Ошибка создания шаблона");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-templates"] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateTemplateData>) => {
      const res = await fetch(`/api/lesson-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Ошибка обновления шаблона");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-templates"] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lesson-templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Ошибка удаления шаблона");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lesson-templates"] });
    },
  });
}
