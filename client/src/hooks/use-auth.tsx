import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation } from "wouter";

type Tutor = {
  id: string;
  email: string;
  name: string;
  subjects: string[];
  basePrice: number;
  timezone: string;
  subscription: "free" | "pro" | "premium";
  subscriptionUntil: string | null;
  isAdmin: boolean;
  publicSlug: string | null;
  publicBio: string | null;
  publicPhone: string | null;
  publicTelegram: string | null;
  isPublicProfile: boolean;
  scheduleStart: number;
  scheduleEnd: number;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  referralCode?: string | null;
};

async function fetchCurrentUser(): Promise<Tutor> {
  const res = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Not authenticated");
  }

  return res.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user, isLoading, error } = useQuery<Tutor>({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 минут
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let message = "Неверный email или пароль";
        try {
          const err = await res.json();
          if (err?.error) message = err.error;
        } catch {
          if (res.status === 404 || res.status === 503) message = "Сервер временно недоступен, попробуйте снова";
          else if (res.status >= 500) message = "Ошибка сервера, попробуйте позже";
        }
        throw new Error(message);
      }

      return res.json();
    },
    onSuccess: (data) => {
      if (data?.requires2FA) return; // login.tsx handles 2FA step
      queryClient.setQueryData(["auth", "me"], data);
      setLocation("/");
    },
  });

  const twoFactorMutation = useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Неверный код");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setLocation("/");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Logout failed");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/login");
    },
  });

  const isAuthenticated = !!user && !error;

  return {
    user,
    isLoading,
    isAuthenticated,
    login: loginMutation.mutate,
    loginData: loginMutation.data,
    logout: logoutMutation.mutate,
    isLoginPending: loginMutation.isPending,
    loginError: loginMutation.error,
    verify2FA: twoFactorMutation.mutate,
    is2FAPending: twoFactorMutation.isPending,
    twoFactorError: twoFactorMutation.error,
    resetLogin: () => loginMutation.reset(),
  };
}
