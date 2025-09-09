import { QueryClient } from "@tanstack/react-query";
import type {
  QueryFunction,
  QueryKey,
  QueryFunctionContext,
} from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
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

/**
 * Devuelve un QueryFunction que:
 * - Hace fetch al endpoint formado por queryKey (join("/"))
 * - Si on401 === "returnNull" y el server responde 401, retorna null
 * - Si no, valida el response y retorna JSON
 */
export const getQueryFn = <T = unknown>({
  on401,
}: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T | null, QueryKey> =>
  async ({ queryKey }: QueryFunctionContext<QueryKey>) => {
    const url =
      Array.isArray(queryKey) ? queryKey.join("/") : String(queryKey);

    const res = await fetch(url, { credentials: "include" });

    if (on401 === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return (await res.json()) as T;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
