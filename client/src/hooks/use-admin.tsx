import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tutor } from "@shared/schema";

type SafeTutor = Omit<Tutor, "password">;

export function useTutors() {
  return useQuery<SafeTutor[]>({
    queryKey: ["admin", "tutors"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tutors", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tutors");
      return res.json();
    },
  });
}

export function useCreateTutor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      name: string;
      subjects: string[];
      subscription: "free" | "pro" | "premium";
      subscriptionUntil?: string | null;
    }) => {
      const res = await fetch("/api/admin/tutors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create tutor");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tutors"] });
    },
  });
}

export function useUpdateTutor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: {
        name?: string;
        subscription?: "free" | "pro" | "premium";
        subscriptionUntil?: string | null;
        subjects?: string[];
      };
    }) => {
      const res = await fetch(`/api/admin/tutors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update tutor");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tutors"] });
    },
  });
}
