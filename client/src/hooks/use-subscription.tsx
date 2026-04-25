import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from "@shared/schema";

interface SubscriptionPrice {
  id: string;
  tier: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
}

export function useSubscriptionPrices() {
  return useQuery<SubscriptionPrice[]>({
    queryKey: ["/api/subscription/prices"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/prices");
      if (!res.ok) throw new Error("Ошибка загрузки цен");
      return res.json();
    },
  });
}

export function useSubscriptionLimits(tier: SubscriptionTier) {
  return SUBSCRIPTION_LIMITS[tier];
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { tier: "pro" | "premium"; period: "monthly" | "yearly" }) => {
      const res = await fetch("/api/subscription/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Ошибка создания платежа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });
}

export function useActivateDemoSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { tier: "pro" | "premium"; period: "monthly" | "yearly" }) => {
      const res = await fetch("/api/subscription/activate-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Ошибка активации");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });
}

export function useAdminUpdatePrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tier, ...updates }: { tier: string; priceMonthly?: number; priceYearly?: number; features?: string[] }) => {
      const res = await fetch(`/api/admin/subscription/prices/${tier}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Ошибка обновления цен");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/prices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription/prices"] });
    },
  });
}
