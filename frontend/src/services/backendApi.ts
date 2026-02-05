export type LocationDto = {
  id?: number | null;
  name: string;
  lat: number;
  lng: number;
  ocCount: number;
  category: string;
  ubigeo: string;
  active: boolean;
};

export type OptimizeRequest = {
  ods: { lat: number; lng: number };
  points: LocationDto[];
  coverageLimit?: number;
  pcDuration?: number;
  ocDuration?: number;
  costs?: {
    km: number;
    food: number;
    hotel: number;
  };
  timeFactor?: number;
};

export type DayLogDto = {
  day: number;
  startLocation?: string;
  start_location?: string;
  
  activityPoints?: string[];
  activity_points?: string[];
  
  activityOcCounts?: Record<string, number>;
  activity_oc_counts?: Record<string, number>;
  
  travelMinutes?: number;
  travel_minutes?: number;
  
  workMinutes?: number;
  work_minutes?: number;
  
  overtimeMinutes?: number;
  overtime_minutes?: number;
  
  totalDayMinutes?: number;
  total_day_minutes?: number;
  
  finalLocation?: string;
  final_location?: string;
  
  isReturn?: boolean;
  is_return?: boolean;
  
  note?: string;
};

export type RouteSegmentDto = {
  id: number;
  name: string;
  totalCost: number;
  distance: number;
  nights: number;
  days: number;
  points: LocationDto[];
  logs: DayLogDto[];
  breakdown?: {
    gas: number;
    food: number;
    hotel: number;
    oc: number;
  };
};

export type OptimizeResponse = {
  sessionId: string;
  totalSystemCost: number;
  routes: RouteSegmentDto[];
  totalDistance: number;
  totalNights: number;
  totalDays: number;
  pointsCovered: number;
};

/**
 * Llama al endpoint POST /api/optimize del backend
 */
export async function optimizeWithBackend(
  payload: OptimizeRequest,
  signal?: AbortSignal
): Promise<OptimizeResponse> {
  try {
    const res = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: signal, // Solo usa el signal externo (botón de cancelar del usuario)
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `Backend error: ${res.status} ${res.statusText}. ${errorText}`
      );
    }

    return await res.json();
  } catch (error: any) {
    // Si el usuario canceló manualmente
    if (error.name === "AbortError") {
      throw new Error("Optimización cancelada por el usuario");
    }
    // Otros errores de red o del servidor
    throw error;
  }
}

/**
 * Descarga el Excel del Plan Maestro
 */
export function downloadExcelReport(sessionId: string) {
  const url = `/reports/plan-maestro/excel/${sessionId}`;
  const link = document.createElement("a");
  link.href = url;
  link.download = "plan_maestro.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
