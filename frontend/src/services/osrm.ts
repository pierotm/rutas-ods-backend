import type { Location } from "../domain/types";
import { OSRM_CHUNK_SIZE } from "../config/constants";

export async function fetchOSRMTable(
  origins: Location[],
  destinations: Location[],
  signal: AbortSignal,
  onProgress?: (curr: number, total: number) => void
): Promise<{ distances: number[][]; durations: number[][] }> {
  const sizeO = origins.length;
  const sizeD = destinations.length;
  const finalDist = Array(sizeO)
    .fill(0)
    .map(() => Array(sizeD).fill(0));
  const finalDur = Array(sizeO)
    .fill(0)
    .map(() => Array(sizeD).fill(0));

  const totalOps = sizeO * Math.ceil(sizeD / OSRM_CHUNK_SIZE);
  let doneOps = 0;

  for (let i = 0; i < sizeO; i++) {
    const origin = origins[i];
    for (let c = 0; c < sizeD; c += OSRM_CHUNK_SIZE) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const chunk = destinations.slice(c, c + OSRM_CHUNK_SIZE);

      const coordsList = [origin, ...chunk];
      const urlCoords = coordsList.map((l) => `${l.lng},${l.lat}`).join(";");
      const url = `https://router.project-osrm.org/table/v1/driving/${urlCoords}?sources=0&annotations=distance,duration`;

      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(res.statusText);

      const data = await res.json();
      if (data.code === "Ok") {
        const distRow = data.distances[0];
        const durRow = data.durations[0];
        chunk.forEach((_, chunkIdx) => {
          finalDist[i][c + chunkIdx] = parseFloat(((distRow[chunkIdx + 1] / 1000) as number).toFixed(2));
          finalDur[i][c + chunkIdx] = parseFloat(((durRow[chunkIdx + 1] / 60) as number).toFixed(1));
        });
      }

      // respetar rate limit
      await new Promise((resolve) => setTimeout(resolve, 150));

      doneOps++;
      onProgress?.(doneOps, totalOps);
    }
  }

  return { distances: finalDist, durations: finalDur };
}
