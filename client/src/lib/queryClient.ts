import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Try to extract user-friendly message from JSON error response
    let friendly = text;
    try {
      const parsed = JSON.parse(text);
      friendly = parsed.message || parsed.error || text;
    } catch { /* not JSON */ }
    const err = new Error(`${res.status}: ${friendly}`) as Error & { status?: number; code?: string };
    err.status = res.status;
    try {
      const parsed = JSON.parse(text);
      if (parsed.error) err.code = String(parsed.error);
    } catch {}
    throw err;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Унифицированная инвалидация: исторически в проекте два ключа на один и тот же
// ресурс — короткий ("students") в хуках use-tutor-data и URL-вид
// ("/api/students") в страницах с дефолтным getQueryFn. Любая мутация должна
// сбрасывать ОБА, иначе при переходе между разделами видна устаревшая копия.
const RESOURCE_ALIASES: Record<string, string[]> = {
  students: ["students", "/api/students"],
  lessons: ["lessons", "/api/lessons"],
  payments: ["payments", "/api/payments"],
  homework: ["homework", "/api/homework"],
  tasks: ["tutor-tasks", "/api/tutor-tasks"],
  applications: ["/api/applications", "/api/applications/pending-count"],
  notifications: ["/api/notifications", "notifications"],
  programs: ["/api/programs", "programs"],
};

export function invalidateResource(...resources: string[]) {
  const flat = new Set<string>();
  for (const r of resources) {
    for (const k of (RESOURCE_ALIASES[r] || [r])) flat.add(k);
  }
  return queryClient.invalidateQueries({
    predicate: (q) => {
      const head = q.queryKey?.[0];
      return typeof head === "string" && flat.has(head);
    },
  });
}
