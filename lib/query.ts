import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query"

import { createClient } from "@/lib/supabase/client"

export { keepPreviousData }

export async function getAccessToken() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error("Unauthorized")
  }

  return session.access_token
}

export async function fetchWithAccessToken<T>(input: string, init?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken()
  const response = await fetch(input, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: "Request failed." }))
    throw new Error(result.error ?? "Request failed.")
  }

  return response.json() as Promise<T>
}

export function useAppQuery<TQueryFnData, TData = TQueryFnData>(
  options: UseQueryOptions<TQueryFnData, Error, TData>
): UseQueryResult<TData, Error> {
  return useQuery({
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useAppInfiniteQuery<TQueryFnData, TPageParam = string | null>(
  options: UseInfiniteQueryOptions<TQueryFnData, Error, TQueryFnData, readonly unknown[], TPageParam>
): UseInfiniteQueryResult<TQueryFnData, Error> {
  return useInfiniteQuery(options)
}
