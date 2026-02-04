import React, { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Popup, Polyline, TileLayer } from "react-leaflet";
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
    setLocations((prev) => prev.map((loc) => (loc.id === id ? { ...loc, isActive: !loc.isActive } : loc)));
    setMasterPlan(null);
  };

  const handleOcChange = (locationId: number, increment: boolean) => {
    setLocations((prev) =>
      prev.map((l) => {
        if (l.id === locationId) {
          const currentCount = l.ocCount;
          const newCount = increment ? Math.min(3, currentCount + 1) : Math.max(0, currentCount - 1);
          return { ...l, ocCount: newCount };
        }
        return l;
      })
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
        const lat = parseFloat(row.Latitud || row.latitud || row.Lat || row.lat);
        const lng = parseFloat(row.Longitud || row.longitud || row.Lng || row.lng || row.Lon || row.lon);
        const ubigeo = (row.Ubigeo || row.ubigeo || "").toString().trim();

        let category: "PC" | "OC" = "PC";
        const rawCat = (row.Categoria || row.categoria || row.Cat || row.cat || "").toString().toUpperCase().trim();
        if (rawCat === "OC") category = "OC";

        const relatedUbigeo = (row.Relacion || row.relacion || row.Rel || row.rel || "").toString().trim();

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
        setLogs((prev) => [`✓ Importados ${validNewLocations.length} puntos desde Excel.`, ...prev]);

        if (newLocations.length > spaceRemaining) {
          alert(`Nota: Se importaron solo los primeros ${spaceRemaining} puntos para respetar el límite total de ${targetPoints}.`);
        }
        resetMatrices();
      } else {
        alert("No se encontraron puntos válidos en el Excel. Asegúrese de que las columnas tengan los encabezados: Nombre, Latitud, Longitud.");
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
        row.map((val) => ({ value: parseFloat((val * timeFactor).toFixed(1)), loading: false }))
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
    if (locations.length < 1) return alert("Agrega puntos al mapa o importa desde Excel.");
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

      const { distances, durations } = await fetchOSRMTable(matrixPoints, matrixPoints, ctrl.signal);

      setDistanceMatrix(distances.map((row) => row.map((v) => ({ value: v, loading: false }))));
      setRawTimeMatrix(durations);
      setMatrixLocations(matrixPoints);
      setLogs((prev) => ["✓ Matriz calculada (Datos OSRM).", ...prev]);
    } catch (e: any) {
      if (e.name !== "AbortError") setLogs((prev) => ["❌ Error en Matriz.", ...prev]);
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
    setLogs((prev) => [`🚀 Planificando ruta (Grafo Restringido) para ${Math.min(coverageLimit, enabledLocations.length)} de ${enabledLocations.length} activos...`, ...prev]);

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

      const fullMatrixAvailable = matrixLocations.length > 0 && distanceMatrix.length > 0 && rawTimeMatrix.length > 0;

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
          setLogs((prev) => ["⚡ Reutilizando Matriz existente (Sub-conjunto)...", ...prev]);
          const distMatVals = distanceMatrix.map((row) => row.map((c) => c.value));

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
          setLogs((prev) => ["⚠️ Matriz incompleta, descargando nuevos datos...", ...prev]);
          const res = await fetchOSRMTable(allOptimizationPoints, allOptimizationPoints, ctrl.signal);
          distances = res.distances;
          durations = res.durations;
        }
      } else {
        const res = await fetchOSRMTable(allOptimizationPoints, allOptimizationPoints, ctrl.signal);
        distances = res.distances;
        durations = res.durations;
      }

      setDistanceMatrix(distances.map((row) => row.map((v) => ({ value: v, loading: false }))));
      setRawTimeMatrix(durations);
      setMatrixLocations(allOptimizationPoints);

      const factoredDurations = durations.map((row) => row.map((val) => parseFloat((val * timeFactor).toFixed(1))));

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
        if (ctrl.signal.aborted) throw new DOMException("Aborted", "AbortError");

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
        otherIndices.sort((a, b) => getDist(farthestIdx, a) - getDist(farthestIdx, b));
        const validNeighbors = otherIndices.filter((i) => getDist(farthestIdx, i) !== Infinity);
        const neighbors = validNeighbors.slice(0, SEARCH_POOL_SIZE);

        let bestCandidate = {
          perm: [] as number[],
          cost: Infinity,
          metric: Infinity,
          itin: null as any,
          breakdown: null as any,
        };

        const maxNeighborsToAdd = Math.min(neighbors.length, MAX_COMBO_SIZE - 1);

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
              if (getDist(perm[perm.length - 1], 0) === Infinity) chainValid = false;
              if (!chainValid) continue;

              const itin = calculateItinerary(pathIndices, allOptimizationPoints, factoredDurations, pcDuration, ocDuration);
              if (itin.num_days > MAX_ROUTE_DAYS) continue;

              let d = getDist(0, perm[0]);
              for (let i = 0; i < perm.length - 1; i++) d += getDist(perm[i], perm[i + 1]);
              d += getDist(perm[perm.length - 1], 0);

              const nights = itin.num_nights;
              const gasC = d * costs.km;
              const foodC = costs.food * itin.num_days;
              const hotelC = costs.hotel * nights;

              const ocExtra = perm.reduce((acc, idx) => acc + (allOptimizationPoints[idx]?.ocCount || 0), 0);
              const ocC = ocExtra * OC_UNIT_COST;

              const totalC = gasC + foodC + hotelC + ocC;

              if (totalC < minClusterCost) {
                minClusterCost = totalC;
                bestPermForCluster = perm;
                bestClusterItin = itin;
                bestClusterBreakdown = { gas: gasC, food: foodC, hotel: hotelC, oc: ocC };
              }
            }

            if (bestPermForCluster && bestClusterItin && bestClusterBreakdown) {
              const metric = minClusterCost / bestPermForCluster.length;
              if (metric < bestCandidate.metric) {
                bestCandidate = { perm: bestPermForCluster, cost: minClusterCost, metric, itin: bestClusterItin, breakdown: bestClusterBreakdown };
              }
            }
          }
        }

        if (bestCandidate.perm.length > 0 && bestCandidate.itin && bestCandidate.breakdown) {
          const bestPermIndices = bestCandidate.perm;
          const bestItin = bestCandidate.itin;
          const bestBreakdown = bestCandidate.breakdown;

          let d = getDist(0, bestPermIndices[0]);
          for (let i = 0; i < bestPermIndices.length - 1; i++) d += getDist(bestPermIndices[i], bestPermIndices[i + 1]);
          d += getDist(bestPermIndices[bestPermIndices.length - 1], 0);

          finalRoutes.push({
            id: routeCounter,
            name: `Ruta ${routeCounter}`,
            points: bestPermIndices.map((idx: number) => allOptimizationPoints[idx]),
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
          availableIndices = availableIndices.filter((idx) => !usedSet.has(idx));
        } else {
          const failIdx = farthestIdx;
          const pathIndices = [0, failIdx];
          const itin = calculateItinerary(pathIndices, allOptimizationPoints, factoredDurations, pcDuration, ocDuration);
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
        if (!String(r.color).includes("ef4444")) r.color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      });

      const totalSystemCost = finalRoutes.reduce((acc: number, r: any) => acc + r.totalCost, 0);
      const totalDistance = finalRoutes.reduce((acc: number, r: any) => acc + r.distance, 0);
      const totalNights = finalRoutes.reduce((acc: number, r: any) => acc + r.nights, 0);
      const totalDays = finalRoutes.reduce((acc: number, r: any) => acc + r.days, 0);

      setMasterPlan({
        totalSystemCost,
        routes: finalRoutes,
        totalDistance,
        totalNights,
        totalDays,
        pointsCovered: activeLocations.length,
      });

      setLogs((prev) => [`✓ Plan generado para ${activeLocations.length} puntos activos.`, ...prev]);
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

    const pcCount = masterPlan.routes.reduce((acc, r) => acc + r.points.filter((p) => p.category === "PC").length, 0);
    const ocCount = masterPlan.routes.reduce((acc, r) => acc + r.points.filter((p) => p.category === "OC").length, 0);

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-sunass-blue text-white p-4 rounded-2xl shadow-xl border border-sunass-blue transform hover:scale-102 transition-transform col-span-2 md:col-span-1">
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-80">Costo Total Sistema</p>
            <p className="text-2xl font-black mt-1">S/. {masterPlan.totalSystemCost.toFixed(2)}</p>
            <p className="text-[8px] mt-2 italic opacity-90">Para {masterPlan.pointsCovered} puntos</p>
          </div>
          <div className="bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rutas Generadas</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{masterPlan.routes.length}</p>
            <p className="text-[8px] text-slate-400 mt-2 italic">Flota requerida</p>
          </div>
          <div className="bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Puntos PC</p>
            <p className="text-2xl font-black text-sunass-blue mt-1">{pcCount}</p>
            <p className="text-[8px] text-slate-400 mt-2 italic">Cubiertos</p>
          </div>
          <div className="bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Puntos OC</p>
            <p className="text-2xl font-black text-purple-600 mt-1">{ocCount}</p>
            <p className="text-[8px] text-slate-400 mt-2 italic">Cubiertos</p>
          </div>
          <div className="bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Distancia Total</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{masterPlan.totalDistance.toFixed(0)} km</p>
          </div>
          <div className="bg-white border-2 border-slate-100 p-4 rounded-2xl shadow-sm">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Noches</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{masterPlan.totalNights}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {masterPlan.routes.map((route) => (
            <div key={route.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: route.color }}></div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">{route.name}</h4>
                  <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">{route.points.length} puntos</span>
                </div>
                <div className="flex gap-4 text-xs font-mono font-bold text-slate-600 mt-2 md:mt-0">
                  <span><i className="fa-solid fa-road mr-1"></i>{route.distance}km</span>
                  <span className={route.days > MAX_ROUTE_DAYS ? "text-red-500 font-black animate-pulse" : ""}><i className="fa-solid fa-calendar-day mr-1"></i>{route.days}d</span>
                  <span><i className="fa-solid fa-moon mr-1"></i>{route.nights}n</span>
                  <span className="text-sunass-blue"><i className="fa-solid fa-sack-dollar mr-1"></i>S/. {route.totalCost.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-0">
                <table className="w-full text-[11px] font-medium">
                  <thead className="bg-white text-slate-400 uppercase font-bold text-[9px] tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-2 text-center">Día</th>
                      <th className="px-6 py-2 text-left">Itinerario Detallado</th>
                      <th className="px-6 py-2 text-center">Tiempos</th>
                      <th className="px-6 py-2 text-right">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {route.logs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-center font-black text-slate-700">Día {log.day}</td>
                        <td className="px-6 py-3">
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-slate-500">{log.start_location}</span>
                            <i className="fa-solid fa-arrow-right text-[8px] text-slate-300"></i>
                            {log.activity_points.map((p, i) => {
                              const pt = route.points.find((x) => x.name === p);
                              const isOC = pt?.category === "OC";
                              const ocCount = log.activity_oc_counts[p] || 0;
                              return (
                                <React.Fragment key={i}>
                                  <span className={`font-bold ${isOC ? "text-purple-600 bg-purple-50" : "text-sunass-blue bg-blue-50"} px-2 py-0.5 rounded flex items-center gap-1`}>
                                    {p}
                                    {ocCount > 0 && <span className="text-[9px] bg-purple-600 text-white px-1 rounded">+{ocCount}</span>}
                                  </span>
                                  {i < log.activity_points.length - 1 && <i className="fa-solid fa-arrow-right text-[8px] text-slate-300"></i>}
                                </React.Fragment>
                              );
                            })}
                            {log.is_return && (
                              <>
                                <i className="fa-solid fa-arrow-right text-[8px] text-slate-300"></i>
                                <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                                  ODS <i className="fa-solid fa-flag-checkered text-[10px]"></i>
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <div className="flex flex-col items-center gap-1 font-mono text-[10px]">
                            <span className="text-slate-500">🚗 {log.travel_minutes}m</span>
                            <span className="text-slate-500">🛠️ {log.work_minutes}m</span>
                            {log.overtime_minutes > 0 && <span className="text-red-500 font-black">⏱️ +{log.overtime_minutes}m</span>}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right text-[10px] text-slate-400 italic max-w-[250px]">{log.note || "-"}</td>
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

  // --- UI principal (layout optimizado: header + (mapa/panel) + resultados) ---
  return (
  <div className="h-screen w-full bg-slate-100 overflow-hidden">
    <div className="h-full grid grid-rows-[72px_520px_1fr] gap-4 p-4 max-w-[1920px] mx-auto">

      {/* HEADER: Identidad y Acciones Globales */}
      <header className="bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-sunass-blue rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <i className="fa-solid fa-route text-lg"></i>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none">Planificador de Rutas ODS</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ingeniería de Software • Laleska Arroyo</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 mr-4">
            <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
              matrixLocations.length ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-50 text-slate-400 border-slate-100"
            }`}>
              {matrixLocations.length ? `● Matriz: ${matrixLocations.length} pts` : "○ Matriz pendiente"}
            </span>
          </div>

          <button
            onClick={handleResetPoints}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-trash-can"></i> Limpiar
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2"
          >
            <i className="fa-solid fa-file-excel"></i> Importar Excel
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
        </div>
      </header>

      {/* ROW 2: ENTORNO DE TRABAJO (MAPA + CONFIG) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-4 min-h-0">
        
        {/* MAPA */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden relative min-h-0 group">
          <MapContainer
            ref={mapRef}
            center={[-12.0464, -77.0428]}
            zoom={6}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapClickHandler onClick={handleMapClick} />
            <MapSearchControl />

            {locations.map((loc, idx) => (
              <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={createCustomIcon(idx + 1, "#005596", loc.isActive)}>
                <Popup>
                  <div className="p-1 min-w-[180px]">
                    <p className="font-black text-slate-800 text-sm">{loc.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mb-2">{loc.coords}</p>
                    <div className="flex justify-between text-[10px] mb-3 bg-slate-50 p-2 rounded-lg">
                      <span>Categoría: <b>{loc.category}</b></span>
                      <span>OCs: <b>{loc.ocCount}</b></span>
                    </div>
                    
                    {loc.category === "PC" && (
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[9px] font-black uppercase text-slate-400">Actividades OC</span>
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                          <button onClick={(e) => { e.stopPropagation(); handleOcChange(loc.id, false); }} className="w-6 h-6 rounded-md hover:bg-white text-slate-600 transition-all">-</button>
                          <span className="w-6 text-center font-bold text-xs">{loc.ocCount}</span>
                          <button onClick={(e) => { e.stopPropagation(); handleOcChange(loc.id, true); }} className="w-6 h-6 rounded-md hover:bg-white text-slate-600 transition-all">+</button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleActive(loc.id); }}
                      className={`w-full py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${
                        loc.isActive ? "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      {loc.isActive ? "Excluir del cálculo" : "Incluir en cálculo"}
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {masterPlan?.routes?.map((route) => (
              <Polyline key={route.id} pathOptions={{ color: route.color, weight: 4, opacity: 0.8 }} positions={route.points.map(p => [p.lat, p.lng]) as any} />
            ))}
          </MapContainer>
        </section>

        {/* PANEL DE CONTROL */}
        <aside className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-0">
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
            
            {/* Configuración de Origen */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Configuración Base</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="relative">
                  <label className="text-[9px] font-black text-slate-500 uppercase absolute -top-2 left-3 bg-white px-1">Coordenadas ODS</label>
                  <input
                    value={odsInput}
                    onChange={(e) => setOdsInput(e.target.value)}
                    placeholder="-12.0464, -77.0428"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold focus:border-sunass-blue outline-none transition-all"
                  />
                </div>
                
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  {['matrix', 'optimization'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setViewMode(m as any)}
                      className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        viewMode === m ? "bg-white text-sunass-blue shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {m === 'matrix' ? 'Matriz OSRM' : 'Optimización'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Costos y Factores */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2">Parámetros Económicos</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Costo KM", val: costs.km, key: "km", sym: "S/." },
                  { label: "F. Tiempo", val: timeFactor, key: "time", sym: "x" },
                  { label: "Alimentación", val: costs.food, key: "food", sym: "S/." },
                  { label: "Alojamiento", val: costs.hotel, key: "hotel", sym: "S/." }
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">{item.label}</label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-300">{item.sym}</span>
                      <input
                        type="number"
                        value={item.val}
                        onChange={(e) => item.key === "time" ? setTimeFactor(parseFloat(e.target.value)) : setCosts({ ...costs, [item.key]: parseFloat(e.target.value) })}
                        className="w-full bg-transparent text-xs font-black text-slate-700 outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botonera Principal */}
            <div className="pt-2 space-y-3">
              <button
                onClick={viewMode === "matrix" ? runMatrixCalculation : runMasterPlanOptimization}
                disabled={isProcessing || isOptimizing || !odsInput || locations.length === 0}
                className="w-full py-4 rounded-2xl bg-sunass-blue text-white font-black text-xs uppercase tracking-[0.15em] transition-all hover:bg-sunass-dark hover:shadow-lg disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-3 shadow-xl shadow-blue-100"
              >
                {isProcessing || isOptimizing ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                {viewMode === "matrix" ? "Calcular Matriz de Distancias" : "Generar Plan Maestro"}
              </button>

              <button
                onClick={stopProcessing}
                className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Detener Proceso
              </button>
            </div>

            {/* Consola de Logs */}
            <div className="bg-slate-900 rounded-2xl p-4 h-32 overflow-y-auto font-mono text-[9px] text-emerald-400 shadow-inner border border-slate-800 custom-scrollbar-dark">
              {logs.length === 0 && <span className="opacity-40">Esperando acciones...</span>}
              {logs.map((l, i) => (
                <div key={i} className="mb-1 leading-tight flex gap-2">
                  <span className="text-slate-600">[{logs.length - i}]</span>
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ROW 3: DATOS Y RESULTADOS (TABLAS) */}
      <footer className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-h-0 flex flex-col">
        <div className="flex-1 overflow-auto custom-scrollbar">

          {/* VISTA MATRIZ */}
          {viewMode === "matrix" && matrixLocations.length > 0 ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
              <div className="p-4 bg-slate-50 border-b flex justify-between items-center sticky top-0 z-20">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Matriz de Costeo {activeTab === 'distance' ? '(Kilómetros)' : '(Minutos)'}</span>
                <div className="flex gap-2">
                  <button onClick={() => setActiveTab("distance")} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'distance' ? "bg-sunass-blue text-white shadow-md" : "bg-white text-slate-400 border border-slate-200"}`}>Km</button>
                  <button onClick={() => setActiveTab("time")} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeTab === 'time' ? "bg-sunass-blue text-white shadow-md" : "bg-white text-slate-400 border border-slate-200"}`}>Min</button>
                </div>
              </div>
              
              <div className="overflow-auto flex-1">
                <table className="w-full text-[11px] border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="p-4 bg-slate-100 border-b border-r border-slate-200 text-slate-500 font-black text-left sticky left-0 z-30 uppercase text-[9px]">Punto Origen / Destino</th>
                      {matrixLocations.map((l) => (
                        <th key={l.id} className={`p-4 border-b border-slate-200 min-w-[110px] text-center font-black uppercase text-[9px] ${l.id === -1 ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-600"}`}>
                          {l.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixLocations.map((rl, i) => (
                      <tr key={rl.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className={`p-3 border-b border-r border-slate-100 sticky left-0 z-10 font-black uppercase text-[9px] transition-colors ${rl.id === -1 ? "bg-blue-50 text-blue-600" : "bg-white group-hover:bg-blue-50 text-slate-500"}`}>
                          {rl.name}
                        </td>
                        {matrixLocations.map((_, j) => {
                          const cellData = activeTab === "distance" ? distanceMatrix[i]?.[j] : timeMatrix[i]?.[j];
                          return (
                            <td key={j} className={`p-3 border-b border-slate-100 text-center font-mono text-[10px] ${i === j ? "bg-slate-50/50 text-slate-200" : "text-slate-600"}`}>
                              {i === j ? "—" : cellData?.value || "..."}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : viewMode === "matrix" && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-60">
              <i className="fa-solid fa-table-cells text-5xl"></i>
              <p className="font-black uppercase text-xs tracking-[0.2em]">Matriz no calculada</p>
            </div>
          )}

          {/* VISTA PLAN MAESTRO */}
          {viewMode === "optimization" && masterPlan ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-50 p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase">Resultados Óptimos</div>
                  <h3 className="font-black text-slate-700 text-sm uppercase tracking-tight">Informe Plan Maestro (100% Cobertura)</h3>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => downloadMasterPDF({ masterPlan, matrixLocations, distanceMatrix, costs, pcDuration, ocDuration })}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
                  >
                    <i className="fa-solid fa-file-pdf"></i> Exportar PDF
                  </button>
                  <button
                    onClick={() => downloadMasterCSV({ masterPlan, matrixLocations, distanceMatrix, costs, pcDuration, ocDuration })}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
                  >
                    <i className="fa-solid fa-file-csv"></i> Exportar CSV
                  </button>
                </div>
              </div>

              <div className="p-8 bg-slate-50/30">
                {renderMasterPlan()}
              </div>
            </div>
          ) : viewMode === "optimization" && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-60">
              <i className="fa-solid fa-wand-magic-sparkles text-5xl"></i>
              <p className="font-black uppercase text-xs tracking-[0.2em]">Plan Maestro pendiente de generación</p>
            </div>
          )}
        </div>
      </footer>
    </div>
  </div>
);
}
