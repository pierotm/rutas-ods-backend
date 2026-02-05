import React, { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
} from "react-leaflet";
import L from "leaflet";

declare const XLSX: any;

import type { Location, Matrix, MasterPlanResult } from "./domain/types";
import { ROUTE_COLORS, MAX_ROUTE_DAYS, OC_UNIT_COST } from "./config/constants";
import { parseCoords } from "./utils/coords";
import { getCombinations, getPermutations } from "./utils/combinatorics";
import { calculateItinerary } from "./domain/itinerary";
import { fetchOSRMTable } from "./services/osrm";
import { downloadMasterCSV, downloadMasterPDF } from "./services/export";

import MapClickHandler from "./ui/components/MapClickHandler";
import MapSearchControl from "./ui/components/MapSearchControl";
import { createCustomIcon } from "./ui/components/icons";

const isValidConnection = (_a: Location, _b: Location): boolean => true;

export default function App() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [targetPoints, setTargetPoints] = useState<number>(100);
  const [distanceMatrix, setDistanceMatrix] = useState<Matrix>([]);
  const [timeMatrix, setTimeMatrix] = useState<Matrix>([]);
  const [rawTimeMatrix, setRawTimeMatrix] = useState<number[][]>([]);
  const [matrixLocations, setMatrixLocations] = useState<Location[]>([]);
  const [odsInput, setOdsInput] = useState<string>("");

  const [costs, setCosts] = useState({ km: 1, food: 180, hotel: 570 });
  const [timeFactor, setTimeFactor] = useState<number>(1.0);

  const [pcDuration, setPcDuration] = useState<number>(180);
  const [ocDuration, setOcDuration] = useState<number>(180);

  const [coverageLimit, setCoverageLimit] = useState<number>(0);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [masterPlan, setMasterPlan] = useState<MasterPlanResult | null>(null);
  const [activeTab, setActiveTab] = useState<"distance" | "time">("distance");
  const [viewMode, setViewMode] = useState<"matrix" | "optimization">("matrix");
  const [logs, setLogs] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mapRef = useRef<L.Map | null>(null);

  const resetMatrices = () => {
    setDistanceMatrix([]);
    setTimeMatrix([]);
    setRawTimeMatrix([]);
    setMatrixLocations([]);
    setMasterPlan(null);
  };

  const handleMapClick = (latlng: L.LatLng) => {
    if (locations.length >= targetPoints) {
      alert(`Ya has seleccionado el máximo de ${targetPoints} puntos.`);
      return;
    }
    const newId = locations.length + 1;
    const newLoc: Location = {
      id: newId,
      name: `Punto ${newId}`,
      coords: `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`,
      lat: latlng.lat,
      lng: latlng.lng,
      ocCount: 0,
      category: "PC",
      ubigeo: `MANUAL-${newId}`,
      isActive: true,
    };
    setLocations((prev) => [...prev, newLoc]);
    setLogs((prev) => [`Punto ${newId} agregado manualmente (PC).`, ...prev]);
    resetMatrices();
  };

  const handleResetPoints = () => {
    setLocations([]);
    resetMatrices();
    setLogs((prev) => ["Puntos limpiados.", ...prev]);
  };

  const handleToggleActive = (id: number) => {
    setLocations((prev) =>
      prev.map((loc) =>
        loc.id === id ? { ...loc, isActive: !loc.isActive } : loc,
      ),
    );
    setMasterPlan(null);
  };

  const handleOcChange = (locationId: number, increment: boolean) => {
    setLocations((prev) =>
      prev.map((l) => {
        if (l.id === locationId) {
          const currentCount = l.ocCount;
          const newCount = increment
            ? Math.min(3, currentCount + 1)
            : Math.max(0, currentCount - 1);
          return { ...l, ocCount: newCount };
        }
        return l;
      }),
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const spaceRemaining = targetPoints - locations.length;
    if (spaceRemaining <= 0) {
      alert(`Has alcanzado el límite máximo de ${targetPoints} puntos.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const newLocations: Location[] = [];
      let startId = locations.length + 1;

      (jsonData as any[]).forEach((row: any) => {
        const name = row.Nombre || row.nombre || `Punto ${startId}`;
        const lat = parseFloat(
          row.Latitud || row.latitud || row.Lat || row.lat,
        );
        const lng = parseFloat(
          row.Longitud ||
            row.longitud ||
            row.Lng ||
            row.lng ||
            row.Lon ||
            row.lon,
        );
        const ubigeo = (row.Ubigeo || row.ubigeo || "").toString().trim();

        let category: "PC" | "OC" = "PC";
        const rawCat = (
          row.Categoria ||
          row.categoria ||
          row.Cat ||
          row.cat ||
          ""
        )
          .toString()
          .toUpperCase()
          .trim();
        if (rawCat === "OC") category = "OC";

        const relatedUbigeo = (
          row.Relacion ||
          row.relacion ||
          row.Rel ||
          row.rel ||
          ""
        )
          .toString()
          .trim();

        if (!isNaN(lat) && !isNaN(lng)) {
          newLocations.push({
            id: startId++,
            name: name.toString(),
            coords: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            lat,
            lng,
            ocCount: 0,
            ubigeo: ubigeo || `AUTO-${startId}`,
            category,
            relatedUbigeo: category === "OC" ? relatedUbigeo : undefined,
            isActive: true,
          });
        }
      });

      const validNewLocations = newLocations.slice(0, spaceRemaining);

      if (validNewLocations.length > 0) {
        setLocations((prev) => [...prev, ...validNewLocations]);
        setLogs((prev) => [
          `✓ Importados ${validNewLocations.length} puntos desde Excel.`,
          ...prev,
        ]);

        if (newLocations.length > spaceRemaining) {
          alert(
            `Nota: Se importaron solo los primeros ${spaceRemaining} puntos para respetar el límite total de ${targetPoints}.`,
          );
        }
        resetMatrices();
      } else {
        alert(
          "No se encontraron puntos válidos en el Excel. Asegúrese de que las columnas tengan los encabezados: Nombre, Latitud, Longitud.",
        );
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    setCoverageLimit(locations.filter((l) => l.isActive).length);
  }, [locations]);

  useEffect(() => {
    if (rawTimeMatrix.length > 0) {
      const factored = rawTimeMatrix.map((row) =>
        row.map((val) => ({
          value: parseFloat((val * timeFactor).toFixed(1)),
          loading: false,
        })),
      );
      setTimeMatrix(factored);
    }
  }, [timeFactor, rawTimeMatrix]);

  // Evita glitches Leaflet al cambiar layout / resultados
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [viewMode, masterPlan, matrixLocations.length]);

  const runMatrixCalculation = async () => {
    if (locations.length < 1)
      return alert("Agrega puntos al mapa o importa desde Excel.");
    const ods = parseCoords(odsInput);
    if (!ods) return alert("Ingresa coordenadas ODS válidas.");

    abortControllerRef.current?.abort();
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;

    setIsProcessing(true);
    try {
      const odsLoc: Location = {
        id: -1,
        name: "ODS (Base)",
        coords: odsInput,
        lat: ods.lat,
        lng: ods.lng,
        ocCount: 0,
        category: "PC",
        ubigeo: "ODS-MAIN",
        isActive: true,
      };
      const matrixPoints = [odsLoc, ...locations];

      const { distances, durations } = await fetchOSRMTable(
        matrixPoints,
        matrixPoints,
        ctrl.signal,
      );

      setDistanceMatrix(
        distances.map((row) => row.map((v) => ({ value: v, loading: false }))),
      );
      setRawTimeMatrix(durations);
      setMatrixLocations(matrixPoints);
      setLogs((prev) => ["✓ Matriz calculada (Datos OSRM).", ...prev]);
    } catch (e: any) {
      if (e.name !== "AbortError")
        setLogs((prev) => ["❌ Error en Matriz.", ...prev]);
    } finally {
      setIsProcessing(false);
    }
  };

  const runMasterPlanOptimization = async () => {
    if (locations.length === 0) return alert("Agrega puntos.");
    const ods = parseCoords(odsInput);
    if (!ods) return alert("Coords ODS inválidas.");

    abortControllerRef.current?.abort();
    const ctrl = new AbortController();
    abortControllerRef.current = ctrl;

    setIsOptimizing(true);
    setViewMode("optimization");

    const enabledLocations = locations.filter((l) => l.isActive);
    setLogs((prev) => [
      `🚀 Planificando ruta (Grafo Restringido) para ${Math.min(coverageLimit, enabledLocations.length)} de ${enabledLocations.length} activos...`,
      ...prev,
    ]);

    try {
      const odsLoc: Location = {
        id: -1,
        name: "ODS (Base)",
        coords: odsInput,
        lat: ods.lat,
        lng: ods.lng,
        ocCount: 0,
        category: "PC",
        ubigeo: "ODS-MAIN",
        isActive: true,
      };
      const activeLocations = enabledLocations.slice(0, coverageLimit);
      const allOptimizationPoints = [odsLoc, ...activeLocations];

      let distances: number[][];
      let durations: number[][];

      const fullMatrixAvailable =
        matrixLocations.length > 0 &&
        distanceMatrix.length > 0 &&
        rawTimeMatrix.length > 0;

      if (fullMatrixAvailable) {
        const subDist: number[][] = [];
        const subDur: number[][] = [];
        const indexMap: number[] = [];
        let mappingSuccess = true;

        for (const pt of allOptimizationPoints) {
          const idx = matrixLocations.findIndex((m) => m.coords === pt.coords);
          if (idx === -1) {
            mappingSuccess = false;
            break;
          }
          indexMap.push(idx);
        }

        if (mappingSuccess) {
          setLogs((prev) => [
            "⚡ Reutilizando Matriz existente (Sub-conjunto)...",
            ...prev,
          ]);
          const distMatVals = distanceMatrix.map((row) =>
            row.map((c) => c.value),
          );

          for (let i = 0; i < allOptimizationPoints.length; i++) {
            const rowD: number[] = [];
            const rowT: number[] = [];
            for (let j = 0; j < allOptimizationPoints.length; j++) {
              rowD.push(distMatVals[indexMap[i]][indexMap[j]]);
              rowT.push(rawTimeMatrix[indexMap[i]][indexMap[j]]);
            }
            subDist.push(rowD);
            subDur.push(rowT);
          }
          distances = subDist;
          durations = subDur;
        } else {
          setLogs((prev) => [
            "⚠️ Matriz incompleta, descargando nuevos datos...",
            ...prev,
          ]);
          const res = await fetchOSRMTable(
            allOptimizationPoints,
            allOptimizationPoints,
            ctrl.signal,
          );
          distances = res.distances;
          durations = res.durations;
        }
      } else {
        const res = await fetchOSRMTable(
          allOptimizationPoints,
          allOptimizationPoints,
          ctrl.signal,
        );
        distances = res.distances;
        durations = res.durations;
      }

      setDistanceMatrix(
        distances.map((row) => row.map((v) => ({ value: v, loading: false }))),
      );
      setRawTimeMatrix(durations);
      setMatrixLocations(allOptimizationPoints);

      const factoredDurations = durations.map((row) =>
        row.map((val) => parseFloat((val * timeFactor).toFixed(1))),
      );

      const getDist = (i: number, j: number) => {
        const p1 = allOptimizationPoints[i];
        const p2 = allOptimizationPoints[j];
        if (!isValidConnection(p1, p2)) return Infinity;
        return distances[i][j];
      };

      let availableIndices: number[] = activeLocations.map((_, i) => i + 1);
      const finalRoutes: any[] = [];
      let routeCounter = 1;

      const SEARCH_POOL_SIZE = 9;
      const MAX_COMBO_SIZE = 6;

      while (availableIndices.length > 0) {
        if (ctrl.signal.aborted)
          throw new DOMException("Aborted", "AbortError");

        let farthestIdx = -1;
        let maxDist = -1;
        for (const idx of availableIndices) {
          const d = getDist(0, idx);
          if (d !== Infinity && d > maxDist) {
            maxDist = d;
            farthestIdx = idx;
          }
        }
        if (farthestIdx === -1) farthestIdx = availableIndices[0];

        const otherIndices = availableIndices.filter((i) => i !== farthestIdx);
        otherIndices.sort(
          (a, b) => getDist(farthestIdx, a) - getDist(farthestIdx, b),
        );
        const validNeighbors = otherIndices.filter(
          (i) => getDist(farthestIdx, i) !== Infinity,
        );
        const neighbors = validNeighbors.slice(0, SEARCH_POOL_SIZE);

        let bestCandidate = {
          perm: [] as number[],
          cost: Infinity,
          metric: Infinity,
          itin: null as any,
          breakdown: null as any,
        };

        const maxNeighborsToAdd = Math.min(
          neighbors.length,
          MAX_COMBO_SIZE - 1,
        );

        for (let k = 0; k <= maxNeighborsToAdd; k++) {
          const neighborCombos = getCombinations<number>(neighbors, k);
          for (const combo of neighborCombos) {
            const clusterIndices = [farthestIdx, ...combo];
            const perms = getPermutations<number>(clusterIndices);

            let bestPermForCluster: number[] | null = null;
            let minClusterCost = Infinity;
            let bestClusterItin: any = null;
            let bestClusterBreakdown: any = null;

            for (const perm of perms) {
              const pathIndices = [0, ...perm];

              let chainValid = true;
              if (getDist(0, perm[0]) === Infinity) chainValid = false;
              for (let z = 0; z < perm.length - 1; z++) {
                if (getDist(perm[z], perm[z + 1]) === Infinity) {
                  chainValid = false;
                  break;
                }
              }
              if (getDist(perm[perm.length - 1], 0) === Infinity)
                chainValid = false;
              if (!chainValid) continue;

              const itin = calculateItinerary(
                pathIndices,
                allOptimizationPoints,
                factoredDurations,
                pcDuration,
                ocDuration,
              );
              if (itin.num_days > MAX_ROUTE_DAYS) continue;

              let d = getDist(0, perm[0]);
              for (let i = 0; i < perm.length - 1; i++)
                d += getDist(perm[i], perm[i + 1]);
              d += getDist(perm[perm.length - 1], 0);

              const nights = itin.num_nights;
              const gasC = d * costs.km;
              const foodC = costs.food * itin.num_days;
              const hotelC = costs.hotel * nights;

              const ocExtra = perm.reduce(
                (acc, idx) => acc + (allOptimizationPoints[idx]?.ocCount || 0),
                0,
              );
              const ocC = ocExtra * OC_UNIT_COST;

              const totalC = gasC + foodC + hotelC + ocC;

              if (totalC < minClusterCost) {
                minClusterCost = totalC;
                bestPermForCluster = perm;
                bestClusterItin = itin;
                bestClusterBreakdown = {
                  gas: gasC,
                  food: foodC,
                  hotel: hotelC,
                  oc: ocC,
                };
              }
            }

            if (bestPermForCluster && bestClusterItin && bestClusterBreakdown) {
              const metric = minClusterCost / bestPermForCluster.length;
              if (metric < bestCandidate.metric) {
                bestCandidate = {
                  perm: bestPermForCluster,
                  cost: minClusterCost,
                  metric,
                  itin: bestClusterItin,
                  breakdown: bestClusterBreakdown,
                };
              }
            }
          }
        }

        if (
          bestCandidate.perm.length > 0 &&
          bestCandidate.itin &&
          bestCandidate.breakdown
        ) {
          const bestPermIndices = bestCandidate.perm;
          const bestItin = bestCandidate.itin;
          const bestBreakdown = bestCandidate.breakdown;

          let d = getDist(0, bestPermIndices[0]);
          for (let i = 0; i < bestPermIndices.length - 1; i++)
            d += getDist(bestPermIndices[i], bestPermIndices[i + 1]);
          d += getDist(bestPermIndices[bestPermIndices.length - 1], 0);

          finalRoutes.push({
            id: routeCounter,
            name: `Ruta ${routeCounter}`,
            points: bestPermIndices.map(
              (idx: number) => allOptimizationPoints[idx],
            ),
            logs: bestItin.logs,
            totalCost: bestCandidate.cost,
            breakdown: bestBreakdown,
            distance: parseFloat(d.toFixed(2)),
            nights: bestItin.num_nights,
            days: bestItin.num_days,
            color: "#000",
          });

          routeCounter++;

          const usedSet = new Set(bestPermIndices);
          availableIndices = availableIndices.filter(
            (idx) => !usedSet.has(idx),
          );
        } else {
          const failIdx = farthestIdx;
          const pathIndices = [0, failIdx];
          const itin = calculateItinerary(
            pathIndices,
            allOptimizationPoints,
            factoredDurations,
            pcDuration,
            ocDuration,
          );
          const d = distances[0][failIdx] * 2;
          const nights = itin.num_nights;
          const gasC = d * costs.km;
          const foodC = costs.food * itin.num_days;
          const hotelC = costs.hotel * nights;
          const pObj = allOptimizationPoints[failIdx];
          const ocC = pObj.ocCount * OC_UNIT_COST;
          const totalC = gasC + foodC + hotelC + ocC;

          finalRoutes.push({
            id: routeCounter,
            name: `Ruta ${routeCounter} (⚠️ >5 Días)`,
            points: [pObj],
            logs: itin.logs,
            totalCost: totalC,
            breakdown: { gas: gasC, food: foodC, hotel: hotelC, oc: ocC },
            distance: d,
            nights,
            days: itin.num_days,
            color: "#ef4444",
          });

          routeCounter++;
          availableIndices = availableIndices.filter((i) => i !== failIdx);
        }
      }

      finalRoutes.forEach((r: any, idx: number) => {
        if (!String(r.color).includes("ef4444"))
          r.color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      });

      const totalSystemCost = finalRoutes.reduce(
        (acc: number, r: any) => acc + r.totalCost,
        0,
      );
      const totalDistance = finalRoutes.reduce(
        (acc: number, r: any) => acc + r.distance,
        0,
      );
      const totalNights = finalRoutes.reduce(
        (acc: number, r: any) => acc + r.nights,
        0,
      );
      const totalDays = finalRoutes.reduce(
        (acc: number, r: any) => acc + r.days,
        0,
      );

      setMasterPlan({
        totalSystemCost,
        routes: finalRoutes,
        totalDistance,
        totalNights,
        totalDays,
        pointsCovered: activeLocations.length,
      });

      setLogs((prev) => [
        `✓ Plan generado para ${activeLocations.length} puntos activos.`,
        ...prev,
      ]);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error(e);
        setLogs((prev) => ["❌ Error en Optimización.", ...prev]);
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  const stopProcessing = () => {
    abortControllerRef.current?.abort();
    setIsProcessing(false);
    setIsOptimizing(false);
  };

  const renderMasterPlan = () => {
    if (!masterPlan) return null;

    const pcCount = masterPlan.routes.reduce(
      (acc, r) => acc + r.points.filter((p) => p.category === "PC").length,
      0,
    );
    const ocCount = masterPlan.routes.reduce(
      (acc, r) => acc + r.points.filter((p) => p.category === "OC").length,
      0,
    );

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-sunass-blue text-white p-4 rounded-2xl shadow-xl border border-sunass-blue transform hover:scale-102 transition-transform col-span-2 md:col-span-1">
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-80">
              Costo Total Sistema
            </p>
            <p className="text-2xl font-black mt-1">
              S/. {masterPlan.totalSystemCost.toFixed(2)}
            </p>
            <p className="text-[8px] mt-2 italic opacity-90">
              Para {masterPlan.pointsCovered} puntos
            </p>
          </div>
          <div className="bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Rutas Generadas
            </p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {masterPlan.routes.length}
            </p>
            <p className="text-[8px] text-slate-400 mt-2 italic">
              Flota requerida
            </p>
          </div>
          <div className="bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Puntos PC
            </p>
            <p className="text-2xl font-black text-sunass-blue mt-1">
              {pcCount}
            </p>
            <p className="text-[8px] text-slate-400 mt-2 italic">Cubiertos</p>
          </div>
          <div className="bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Puntos OC
            </p>
            <p className="text-2xl font-black text-purple-600 mt-1">
              {ocCount}
            </p>
            <p className="text-[8px] text-slate-400 mt-2 italic">Cubiertos</p>
          </div>
          <div className="bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Distancia Total
            </p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {masterPlan.totalDistance.toFixed(0)} km
            </p>
          </div>
          <div className="bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Total Noches
            </p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {masterPlan.totalNights}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {masterPlan.routes.map((route) => (
            <div
              key={route.id}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: route.color }}
                  ></div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    {route.name}
                  </h4>
                  <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                    {route.points.length} puntos
                  </span>
                </div>
                <div className="flex gap-4 text-xs font-mono font-bold text-slate-600 mt-2 md:mt-0">
                  <span>
                    <i className="fa-solid fa-road mr-1"></i>
                    {route.distance}km
                  </span>
                  <span
                    className={
                      route.days > MAX_ROUTE_DAYS
                        ? "text-red-500 font-black animate-pulse"
                        : ""
                    }
                  >
                    <i className="fa-solid fa-calendar-day mr-1"></i>
                    {route.days}d
                  </span>
                  <span>
                    <i className="fa-solid fa-moon mr-1"></i>
                    {route.nights}n
                  </span>
                  <span className="text-sunass-blue">
                    <i className="fa-solid fa-sack-dollar mr-1"></i>S/.{" "}
                    {route.totalCost.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-0">
                <table className="w-full text-[11px] font-medium">
                  <thead className="bg-white text-slate-400 uppercase font-bold text-[9px] tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-2 text-center">Día</th>
                      <th className="px-6 py-2 text-left">
                        Itinerario Detallado
                      </th>
                      <th className="px-6 py-2 text-center">Tiempos</th>
                      <th className="px-6 py-2 text-right">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {route.logs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-center font-black text-slate-700">
                          Día {log.day}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-slate-500">
                              {log.start_location}
                            </span>
                            <i className="fa-solid fa-arrow-right text-[8px] text-slate-300"></i>
                            {log.activity_points.map((p, i) => {
                              const pt = route.points.find((x) => x.name === p);
                              const isOC = pt?.category === "OC";
                              const ocCount = log.activity_oc_counts[p] || 0;
                              return (
                                <React.Fragment key={i}>
                                  <span
                                    className={`font-bold ${isOC ? "text-purple-600 bg-purple-50" : "text-sunass-blue bg-blue-50"} px-2 py-0.5 rounded flex items-center gap-1`}
                                  >
                                    {p}
                                    {ocCount > 0 && (
                                      <span className="text-[9px] bg-purple-600 text-white px-1 rounded">
                                        +{ocCount}
                                      </span>
                                    )}
                                  </span>
                                  {i < log.activity_points.length - 1 && (
                                    <i className="fa-solid fa-arrow-right text-[8px] text-slate-300"></i>
                                  )}
                                </React.Fragment>
                              );
                            })}
                            {log.is_return && (
                              <>
                                <i className="fa-solid fa-arrow-right text-[8px] text-slate-300"></i>
                                <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                                  ODS{" "}
                                  <i className="fa-solid fa-flag-checkered text-[10px]"></i>
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <div className="flex flex-col items-center gap-1 font-mono text-[10px]">
                            <span className="text-slate-500">
                              🚗 {log.travel_minutes}m
                            </span>
                            <span className="text-slate-500">
                              🛠️ {log.work_minutes}m
                            </span>
                            {log.overtime_minutes > 0 && (
                              <span className="text-red-500 font-black">
                                ⏱️ +{log.overtime_minutes}m
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right text-[10px] text-slate-400 italic max-w-[250px]">
                          {log.note || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 font-sans">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">
        {/* HEADER */}
        <header className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between px-8 py-6 gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
              Planificador de Rutas ODS
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
              Cálculo de rutas óptimas - Laleska Arroyo (IS)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* INDICADOR DE COBERTURA (Recuperado) */}
            <div className="bg-slate-50 px-6 py-2 rounded-2xl border border-slate-100 text-center mr-4">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                Cobertura de Puntos
              </p>
              <p className="text-lg font-black text-sunass-blue">
                {locations.filter((l) => l.isActive).length}{" "}
                <span className="text-slate-300">/</span> {locations.length}
              </p>
            </div>

            <button
              onClick={handleResetPoints}
              className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <i className="fa-solid fa-trash-can mr-2"></i> Limpiar
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
            >
              <i className="fa-solid fa-file-excel"></i> Importar Excel
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </header>

        {/* CUERPO PRINCIPAL: MAPA + CONFIGURACIÓN COMPLETA */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* MAPA */}
          <section className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden relative h-[650px]">
            <MapContainer
              ref={mapRef}
              center={[-12.0464, -77.0428]}
              zoom={6}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler onClick={handleMapClick} />
              <MapSearchControl />

              {/* Renderizado de Marcadores */}
              {locations.map((loc, idx) => (
                <Marker
                  key={loc.id}
                  position={[loc.lat, loc.lng]}
                  icon={createCustomIcon(idx + 1, "#005596", loc.isActive)}
                >
                  <Popup>
                    <div className="p-1 font-sans">
                      <p className="font-black text-slate-800">{loc.name}</p>
                      <p className="text-[10px] text-slate-400 mb-2">
                        {loc.category} | Ubigeo: {loc.ubigeo}
                      </p>
                      <button
                        onClick={() => handleToggleActive(loc.id)}
                        className={`w-full py-2 rounded-lg text-[9px] font-black uppercase ${
                          loc.isActive
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {loc.isActive ? "Desactivar Punto" : "Activar Punto"}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* DIBUJO DE RUTAS DEL PLAN MAESTRO */}
              {masterPlan?.routes?.map((route, routeIdx) => {
                const positions = route.points
                  .filter((p) => p && p.lat && p.lng)
                  .map(
                    (p) => [Number(p.lat), Number(p.lng)] as L.LatLngExpression,
                  );

                if (positions.length < 2) return null;

                return (
                  <Polyline
                    key={`route-${route.id || routeIdx}`}
                    positions={positions}
                    pathOptions={{
                      color:
                        route.color ||
                        ROUTE_COLORS[routeIdx % ROUTE_COLORS.length],
                      weight: 4,
                      opacity: 1,
                      lineJoin: "round",
                      // --- CAMBIO A LÍNEA PUNTEADA ---
                      dashArray: "10, 10",
                      // -------------------------------
                    }}
                  >
                    <Popup>
                      <div className="font-sans p-2">
                        <p className="font-black text-slate-800 uppercase text-[10px]">
                          {route.name}
                        </p>
                      </div>
                    </Popup>
                  </Polyline>
                );
              })}
            </MapContainer>
          </section>

          {/* 2. PANEL LATERAL DE CONFIGURACIÓN EDITABLE */}
          <aside className="w-full lg:w-[450px] space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-8 space-y-6">
              {/* SECCIÓN UNIFICADA DE PARÁMETROS */}
              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-3 flex justify-between items-center">
                  Configuración del Sistema
                  <span className="text-sunass-blue">V2.0</span>
                </h3>

                {/* Input de Coordenadas Integrado */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">
                    <i className="fa-solid fa-location-crosshairs mr-1"></i>{" "}
                    Punto de Origen (Lat, Lng)
                  </label>
                  <input
                    type="text"
                    value={odsInput}
                    onChange={(e) => setOdsInput(e.target.value)}
                    placeholder="-12.0464, -77.0428"
                    className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none focus:text-sunass-blue transition-colors"
                  />
                </div>

                {/* Configuración de Tiempos Actualizada */}
                <div className="grid grid-cols-1 gap-4">
                  {/* Categoría PC */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-2 ml-1">
                      Categoría PC
                    </label>
                    <div className="flex gap-1 flex-wrap">
                      {[3, 4, 4.5, 5].map((t) => (
                        <button
                          key={t}
                          onClick={() => setPcDuration(t)}
                          className={`flex-1 min-w-[50px] py-2 rounded-xl text-[10px] font-black border-2 transition-all ${
                            pcDuration === t
                              ? "border-sunass-blue bg-blue-50 text-sunass-blue"
                              : "border-slate-50 text-slate-300 hover:border-slate-200"
                          }`}
                        >
                          {t}h
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Categoría OC */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-2 ml-1">
                      Categoría OC
                    </label>
                    <div className="flex gap-1 flex-wrap">
                      {[3, 4, 5].map((t) => (
                        <button
                          key={t}
                          onClick={() => setOcDuration(t)}
                          className={`flex-1 min-w-[50px] py-2 rounded-xl text-[10px] font-black border-2 transition-all ${
                            ocDuration === t
                              ? "border-sunass-blue bg-blue-50 text-sunass-blue"
                              : "border-slate-50 text-slate-300 hover:border-slate-200"
                          }`}
                        >
                          {t}h
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Costos y Factores (Grid más compacto) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 relative">
                    <span className="absolute top-2 right-3 text-[8px] font-black text-slate-300 uppercase">
                      Km
                    </span>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">
                      S/. Costo
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={costs.km}
                      onChange={(e) =>
                        setCosts({
                          ...costs,
                          km: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-transparent text-sm font-black text-slate-700 outline-none"
                    />
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 relative">
                    <span className="absolute top-2 right-3 text-[8px] font-black text-slate-300 uppercase">
                      Factor
                    </span>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">
                      F. Tiempo
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={timeFactor}
                      onChange={(e) =>
                        setTimeFactor(parseFloat(e.target.value) || 0)
                      }
                      className="w-full bg-transparent text-sm font-black text-slate-700 outline-none"
                    />
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">
                      S/. Alim.
                    </label>
                    <input
                      type="number"
                      value={costs.food}
                      onChange={(e) =>
                        setCosts({
                          ...costs,
                          food: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-transparent text-sm font-black text-slate-700 outline-none"
                    />
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">
                      S/. Hotel
                    </label>
                    <input
                      type="number"
                      value={costs.hotel}
                      onChange={(e) =>
                        setCosts({
                          ...costs,
                          hotel: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-transparent text-sm font-black text-slate-700 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="pt-4 space-y-3">
                <div className="flex p-1 bg-slate-100 rounded-2xl">
                  <button
                    onClick={() => setViewMode("matrix")}
                    className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${viewMode === "matrix" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
                  >
                    Matriz
                  </button>
                  <button
                    onClick={() => setViewMode("optimization")}
                    className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${viewMode === "optimization" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"}`}
                  >
                    Plan Maestro
                  </button>
                </div>

                <button
                  onClick={
                    viewMode === "matrix"
                      ? runMatrixCalculation
                      : runMasterPlanOptimization
                  }
                  disabled={
                    isProcessing || isOptimizing || locations.length === 0
                  }
                  className="w-full py-4 rounded-2xl bg-sunass-blue hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-blue-100 transition-all disabled:bg-slate-200"
                >
                  {isProcessing || isOptimizing
                    ? "Procesando..."
                    : viewMode === "matrix"
                      ? "Calcular Matriz"
                      : "Generar Plan"}
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* SECCIÓN DE RESULTADOS: Crece dinámicamente hacia abajo */}
        <section className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden min-h-[600px]">
          {/* TABS DE RESULTADOS (Recuperado: Km Distancia / Min Tiempo) */}
          <div className="px-10 py-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/50">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-sunass-blue rounded-2xl shadow-lg flex items-center justify-center text-white">
                <i
                  className={`fa-solid ${viewMode === "matrix" ? "fa-table-cells" : "fa-file-invoice-dollar"} text-xl`}
                ></i>
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                  {viewMode === "matrix"
                    ? "Matriz de Distancias y Tiempos"
                    : "Informe de Optimización Logística"}
                </h2>
                <div className="flex gap-4 mt-1">
                  {viewMode === "matrix" && (
                    <>
                      <button
                        onClick={() => setActiveTab("distance")}
                        className={`text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "distance" ? "text-sunass-blue border-b-2 border-sunass-blue" : "text-slate-400"}`}
                      >
                        Km Distancia
                      </button>
                      <button
                        onClick={() => setActiveTab("time")}
                        className={`text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "time" ? "text-sunass-blue border-b-2 border-sunass-blue" : "text-slate-400"}`}
                      >
                        Min Tiempo
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {viewMode === "optimization" && masterPlan && (
              <div className="flex gap-4">
                <button
                  onClick={() =>
                    downloadMasterPDF({
                      masterPlan,
                      matrixLocations,
                      distanceMatrix,
                      costs,
                      pcDuration,
                      ocDuration,
                    })
                  }
                  className="px-8 py-3 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                >
                  PDF
                </button>
                <button
                  onClick={() =>
                    downloadMasterCSV({
                      masterPlan,
                      matrixLocations,
                      distanceMatrix,
                      costs,
                      pcDuration,
                      ocDuration,
                    })
                  }
                  className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                >
                  Excel
                </button>
              </div>
            )}
          </div>

          {/* CONTENIDO DE RESULTADOS */}
          <div className="p-10">
            {viewMode === "matrix" && matrixLocations.length > 0 ? (
              <div className="overflow-x-auto rounded-[2rem] border border-slate-200 shadow-sm">
                <table className="w-full text-[11px] border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-5 text-left font-black text-slate-400 uppercase tracking-widest border-b sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                        Punto Referencia
                      </th>
                      {matrixLocations.map((l) => (
                        <th
                          key={l.id}
                          className="p-5 text-center font-bold text-slate-700 border-b min-w-[130px] uppercase tracking-tighter"
                        >
                          {l.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixLocations.map((rl, i) => (
                      <tr
                        key={rl.id}
                        className="hover:bg-blue-50/40 transition-all group"
                      >
                        <td className="p-5 font-black text-slate-800 uppercase text-[10px] border-b sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)] group-hover:bg-blue-50 transition-all">
                          {rl.name}
                        </td>
                        {matrixLocations.map((_, j) => (
                          <td
                            key={j}
                            className="p-5 text-center font-mono text-slate-600 border-b"
                          >
                            {i === j ? (
                              <span className="text-slate-200">--</span>
                            ) : (
                              (activeTab === "distance"
                                ? distanceMatrix[i]?.[j]?.value
                                : timeMatrix[i]?.[j]?.value) || "..."
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : viewMode === "optimization" && masterPlan ? (
              <div className="animate-in fade-in duration-700">
                {renderMasterPlan()}
              </div>
            ) : (
              <div className="py-32 text-center">
                <i className="fa-solid fa-layer-group text-6xl text-slate-100 mb-4 block"></i>
                <p className="text-slate-300 font-black uppercase tracking-[0.3em] text-xs">
                  Sin datos para mostrar
                </p>
              </div>
            )}
          </div>
        </section>

        <footer className="py-20 text-center">
          <div className="h-px bg-slate-200 w-24 mx-auto mb-8"></div>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">
            Laleska Arroyo • Sistema de Gestión ODS 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
