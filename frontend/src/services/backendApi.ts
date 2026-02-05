// SERVICIO PARA CONECTAR CON EL BACKEND JAVA

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

export type CostBreakdownDto = {
  gas: number;
  food: number;
  hotel: number;
  oc: number;
};

export type RouteSegmentDto = {
  id?: number | null;
  name?: string;
  totalCost?: number;
  distance?: number;
  nights?: number;
  days?: number;
  points?: LocationDto[];
  logs?: DayLogDto[];
  breakdown?: CostBreakdownDto;
  color?: string;
};

export type OptimizeRequest = {
  ods: { lat: number; lng: number };
  points: LocationDto[];
  coverageLimit?: number;
  pcDuration?: number;
  ocDuration?: number;
  costs?: { km?: number; food?: number; hotel?: number };
  timeFactor?: number;
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
 * Sin timeout automático - solo se cancela si el usuario aborta manualmente
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
      signal: signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `Backend error: ${res.status} ${res.statusText}. ${errorText}`
      );
    }

    return await res.json();
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Optimización cancelada por el usuario");
    }
    throw error;
  }
}

/**
 * Descarga el reporte Excel desde el backend
 */
export async function downloadExcelReport(sessionId: string): Promise<void> {
  try {
    const res = await fetch(`/api/reports/plan-maestro/excel/${sessionId}`);
    
    if (!res.ok) {
      throw new Error(`Error al descargar Excel: ${res.status}`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plan_maestro_detallado.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error descargando Excel:", error);
    throw error;
  }
}