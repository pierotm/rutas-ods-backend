export type LocationDto = {
  id?: number | null;
  name: string;
  lat: number;
  lng: number;
  ocCount?: number;
  category?: string;
  ubigeo?: string;
  active?: boolean;
};

export type OptimizeRequest = {
  ods: { lat: number; lng: number };
  points: LocationDto[];
  coverageLimit?: number;
  pcDuration?: number;
  ocDuration?: number;
  costs?: { km?: number; food?: number; hotel?: number };
  timeFactor?: number;
  constraints?: {
    maxRouteDays?: number;
    searchPoolSize?: number;
    maxComboSize?: number;
  };
};

export type RouteSegmentDto = {
  id?: number | null;
  name?: string;
  totalCost?: number;
  distance?: number;
  nights?: number;
  days?: number;
  points?: LocationDto[];
  logs?: any[];
  breakdown?: any;
};

export type OptimizeResponse = {
  totalSystemCost: number;
  routes: RouteSegmentDto[];
  totalDistance: number;
  totalNights: number;
  totalDays: number;
  pointsCovered: number;
};

/**
 * POST /api/optimize with timeout and AbortSignal handling
 * @param payload OptimizeRequest
 * @param signal optional external AbortSignal
 * @param timeoutMs timeout in milliseconds (default 60s)
 */
export async function optimizeMasterPlan(
  payload: OptimizeRequest,
  signal?: AbortSignal,
  timeoutMs = 60000,
): Promise<OptimizeResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", onExternalAbort);
    }
  }

  try {
    const res = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Optimize request failed: ${res.status} ${res.statusText} ${text}`,
      );
    }

    const data = await res.json();
    return data as OptimizeResponse;
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener("abort", onExternalAbort);
  }
}
