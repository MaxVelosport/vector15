import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Student, Lesson, Payment, Task, Homework } from "@shared/schema";
import { invalidateResource } from "@/lib/queryClient";

// Students
export function useStudents() {
  return useQuery<Student[]>({
    queryKey: ["students"],
    queryFn: async () => {
      const res = await fetch("/api/students", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Student>) => {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to create student");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("students");
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Student> }) => {
      const res = await fetch(`/api/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update student");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("students");
      invalidateResource("lessons");
    },
  });
}

export interface Questionnaire {
  currentLevel: string;
  weakPoints: string;
  strongPoints: string;
  examDate?: string;
  hoursPerWeek: number;
  additionalInfo?: string;
}

export interface ProgramTopic {
  title: string;
  description: string;
  lessonsNeeded: number;
  priority: "high" | "medium" | "low";
  completed: boolean;
}

export interface ProgramData {
  topics: ProgramTopic[];
  totalLessons: number;
  estimatedWeeks: number;
  recommendation: string;
  generatedAt?: string;
  updatedAt?: string;
}

export function useGenerateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, questionnaire }: { studentId: string; questionnaire: Questionnaire }) => {
      const res = await fetch(`/api/students/${studentId}/generate-program`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(questionnaire),
      });
      if (!res.ok) throw new Error("Failed to generate program");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("students");
    },
  });
}

export function useUpdateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, programData }: { studentId: string; programData: ProgramData }) => {
      const res = await fetch(`/api/students/${studentId}/program`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ programData }),
      });
      if (!res.ok) throw new Error("Failed to update program");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("students");
    },
  });
}

export function useDeleteProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (studentId: string) => {
      const res = await fetch(`/api/students/${studentId}/program`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete program");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("students");
    },
  });
}

// Lessons
export function useLessons() {
  return useQuery<Lesson[]>({
    queryKey: ["lessons"],
    queryFn: async () => {
      const res = await fetch("/api/lessons", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lessons");
      return res.json();
    },
  });
}

export function useCreateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Lesson>) => {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create lesson");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("lessons");
    },
  });
}

export function useUpdateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lesson> & { deductFromBalance?: boolean } }) => {
      const res = await fetch(`/api/lessons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update lesson");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("lessons");
      invalidateResource("students");
      invalidateResource("payments");
    },
  });
}

export function useBulkReschedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      studentId: string;
      updates: { lessonId: string; newScheduledAt: string }[];
    }) => {
      const res = await fetch("/api/lessons/bulk-reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to reschedule");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("lessons");
    },
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lessons/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete lesson");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("lessons");
    },
  });
}

// Payments
export function usePayments() {
  return useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: async () => {
      const res = await fetch("/api/payments", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Payment>) => {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create payment");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("payments");
      invalidateResource("students");
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete payment");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("payments");
      invalidateResource("students");
      invalidateResource("lessons");
    },
  });
}

// Tasks
export function useTasks() {
  return useQuery<Task[]>({
    queryKey: ["tutor-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/tutor-tasks", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Task>) => {
      const res = await fetch("/api/tutor-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("tasks");
    },
  });
}

// Homework
export function useHomework() {
  return useQuery<Homework[]>({
    queryKey: ["homework"],
    queryFn: async () => {
      const res = await fetch("/api/homework", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch homework");
      return res.json();
    },
  });
}

export function useCreateHomework() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Homework>) => {
      const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create homework");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("homework");
    },
  });
}

export function useUpdateHomework() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Homework> }) => {
      const res = await fetch(`/api/homework/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update homework");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("homework");
    },
  });
}

// Homework Templates
export function useHomeworkTemplates() {
  return useQuery<any[]>({
    queryKey: ["/api/homework-templates"],
    queryFn: async () => {
      const res = await fetch("/api/homework-templates", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
}

export function useCreateHomeworkTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/homework-templates", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/homework-templates"] }); },
  });
}

export function useUpdateHomeworkTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await fetch(`/api/homework-templates/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(updates) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/homework-templates"] }); },
  });
}

export function useDeleteHomeworkTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/homework-templates/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/homework-templates"] }); },
  });
}

// Monthly Goals
export function useMonthlyGoals() {
  return useQuery<any>({
    queryKey: ["/api/tutor/monthly-goals"],
    queryFn: async () => {
      const res = await fetch("/api/tutor/monthly-goals", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
  });
}

export function useUpdateMonthlyGoals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goals: { lessonsTarget?: number; incomeTarget?: number; newStudentsTarget?: number }) => {
      const res = await fetch("/api/tutor/monthly-goals", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(goals) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tutor/monthly-goals"] }); },
  });
}

// Bulk lesson creation
export function useBulkCreateLessons() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lessons: any[]) => {
      const res = await fetch("/api/lessons/bulk-create", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ lessons }) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      invalidateResource("lessons");
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
  });
}

// Direct Messages (tutor side)
export function useDirectMessages(studentId: string) {
  return useQuery<any[]>({
    queryKey: ["/api/direct-messages", studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const res = await fetch(`/api/direct-messages/${studentId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!studentId,
    refetchInterval: 5000,
  });
}

export function useSendDirectMessage(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, fileUrls }: { content: string; fileUrls?: string[] }) => {
      const res = await fetch(`/api/direct-messages/${studentId}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ content, fileUrls: fileUrls || [] }) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-messages", studentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-messages-summary"] });
    },
  });
}

export function useDeleteDirectMessage(studentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/direct-messages/msg/${messageId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-messages", studentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-messages-summary"] });
    },
  });
}

// Tutor notes on student
export function useUpdateStudentTutorNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await fetch(`/api/students/${id}/tutor-notes`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ notes }) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { invalidateResource("students"); },
  });
}

// Parent report
export function useParentReport(studentId: string) {
  return useQuery<any>({
    queryKey: ["/api/parent-report", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/students/${studentId}/parent-report`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: false, // only fetch on demand
  });
}

// Profile / Tutor
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { name?: string; subjects?: string[]; basePrice?: number; timezone?: string }) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}
