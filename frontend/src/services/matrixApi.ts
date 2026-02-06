// SERVICIO PARA MATRIZ DE DISTANCIAS Y TIEMPOS DESDE EL BACKEND

export type MatrixRequest = {
  ods: { lat: number; lng: number };
  points: Array<{
    id?: number | null;
    name: string;
    lat: number;
    lng: number;
    ocCount?: number;
    category?: string;
    ubigeo?: string;
    active?: boolean;
  }>;
  timeFactor?: number;
};

export type MatrixResponse = {
  distances: number[][];
  durations: number[][];
  labels: string[];
};

/**
 * Calcula la matriz de distancias y tiempos usando el backend Java
 * Este endpoint ejecuta OSRM en el backend y devuelve la matriz completa
 */
export async function calculateMatrixWithBackend(
  payload: MatrixRequest,
  signal?: AbortSignal
): Promise<MatrixResponse> {
  try {
    const res = await fetch("/api/matrix/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `Error calculando matriz: ${res.status} ${res.statusText}. ${errorText}`
      );
    }

    return await res.json();
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Cálculo de matriz cancelado por el usuario");
    }
    throw error;
  }
}

/**
 * Recupera la matriz de una sesión ya calculada
 */
export async function getMatrixFromSession(
  sessionId: string,
  signal?: AbortSignal
): Promise<MatrixResponse> {
  try {
    const res = await fetch(`/api/optimize/${sessionId}/matrix`, {
      method: "GET",
      signal: signal,
    });

    if (!res.ok) {
      throw new Error(`Error obteniendo matriz: ${res.status}`);
    }

    return await res.json();
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Recuperación de matriz cancelada");
    }
    throw error;
  }
}