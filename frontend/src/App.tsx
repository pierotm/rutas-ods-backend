import React, { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
} from "react-leaflet";
import L from "leaflet";
import {
  optimizeWithBackend,
  downloadExcelReport,
} from "./services/backendApi";

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
      `🚀 Enviando ${Math.min(coverageLimit, enabledLocations.length)} puntos al backend...`,
      `⏳ Este proceso puede tomar varios minutos dependiendo de la cantidad de puntos.`,
      ...prev,
    ]);

    try {
      // 🔥 PREPARAR DATOS PARA EL BACKEND
      const payload = {
        ods: { lat: ods.lat, lng: ods.lng },
        points: enabledLocations.slice(0, coverageLimit).map((loc) => ({
          id: loc.id,
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          ocCount: loc.ocCount,
          category: loc.category,
          ubigeo: loc.ubigeo,
          active: loc.isActive,
        })),
        coverageLimit,
        pcDuration,
        ocDuration,
        costs: {
          km: costs.km,
          food: costs.food,
          hotel: costs.hotel,
        },
        timeFactor,
      };

      console.log("📤 Enviando al backend:", payload);

      // 🔥 LLAMAR AL BACKEND
      const response = await optimizeWithBackend(payload, ctrl.signal);

      console.log("📥 Respuesta del backend:", response);

      // 🔥 GUARDAR EL SESSION ID PARA DESCARGAR EXCEL
      const sessionId = response.sessionId;

      // 🔥 TRANSFORMAR RESPUESTA DEL BACKEND AL FORMATO DEL FRONTEND
      const transformedRoutes = response.routes.map((route, idx) => {
        console.log("🔄 Transformando ruta:", route);

        return {
          id: route.id || idx + 1,
          name: route.name || `Ruta ${idx + 1}`,
          points: (route.points || []).map((p) => ({
            id: p.id ?? 0,
            name: p.name || "",
            lat: p.lat || 0,
            lng: p.lng || 0,
            coords: `${p.lat}, ${p.lng}`,
            ocCount: p.ocCount || 0,
            category: (p.category || "PC") as "PC" | "OC",
            ubigeo: p.ubigeo || "",
            isActive: p.active ?? true,
          })),
          logs: (route.logs || []).map((log) => ({
            day: log.day || 1,
            start_location: log.startLocation || log.start_location || "",
            activity_points: log.activityPoints || log.activity_points || [],
            activity_oc_counts:
              log.activityOcCounts || log.activity_oc_counts || {},
            travel_minutes: log.travelMinutes ?? log.travel_minutes ?? 0,
            work_minutes: log.workMinutes ?? log.work_minutes ?? 0,
            overtime_minutes: log.overtimeMinutes ?? log.overtime_minutes ?? 0,
            total_day_minutes:
              log.totalDayMinutes ?? log.total_day_minutes ?? 0,
            final_location: log.finalLocation || log.final_location || "",
            is_return: log.isReturn ?? log.is_return ?? false,
            note: log.note || "",
          })),
          totalCost: route.totalCost || 0,
          breakdown: route.breakdown || { gas: 0, food: 0, hotel: 0, oc: 0 },
          distance: route.distance || 0,
          nights: route.nights || 0,
          days: route.days || 0,
          color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
        };
      });

      console.log("✅ Rutas transformadas:", transformedRoutes);

      // 🔥 ACTUALIZAR ESTADO
      const masterPlanResult = {
        totalSystemCost: response.totalSystemCost || 0,
        routes: transformedRoutes,
        totalDistance: response.totalDistance || 0,
        totalNights: response.totalNights || 0,
        totalDays: response.totalDays || 0,
        pointsCovered: response.pointsCovered || 0,
      };

      console.log("🎯 Plan Maestro Final:", masterPlanResult);

      setMasterPlan(masterPlanResult);

      // Guardar sessionId para descargas
      (window as any).__currentSessionId = sessionId;

      setLogs((prev) => [
        `✓ Plan generado por el backend: ${response.routes.length} rutas para ${response.pointsCovered} puntos.`,
        ...prev,
      ]);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("❌ Error completo:", e);
        setLogs((prev) => [
          `❌ Error al conectar con el backend: ${e.message}`,
          ...prev,
        ]);
        alert(`Error: ${e.message}`);
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

    return (
      <div className="space-y-12">
        {masterPlan.routes.map((route, idx) => (
          <div
            key={idx}
            className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
          >
            {/* Cabecera de la Ruta */}
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
              <div>
                <h4 className="font-black text-slate-800 uppercase tracking-tighter text-lg">
                  {route.name}
                </h4>
                <div className="flex gap-4 mt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {route.points.length} Puntos visitados
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {route.days} Días / {route.nights} Noches
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="block text-2xl font-black text-slate-800">
                  S/. {route.totalCost.toFixed(2)}
                </span>
              </div>
            </div>

            {/* SECUENCIA PRINCIPAL (Requirement: route.points siempre) */}
            <div className="p-8">
              <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-6">
                Secuencia de Puntos
              </h5>
              <div className="flex flex-wrap gap-3">
                {route.points.map((p, pIdx) => (
                  <div key={pIdx} className="flex items-center gap-3">
                    <div className="bg-slate-100 px-4 py-2 rounded-xl flex items-center gap-2 border border-slate-200">
                      <span className="text-[10px] font-black text-slate-400">
                        {pIdx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {p.name}
                      </span>
                      {p.ocCount > 0 && (
                        <span className="bg-sunass-blue/10 text-sunass-blue text-[9px] px-1.5 py-0.5 rounded-md font-black">
                          +{p.ocCount} OC
                        </span>
                      )}
                    </div>
                    {pIdx < route.points.length - 1 && (
                      <i className="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* LOGS DIARIOS (Requirement: logs si existen; si no, ocúltalos) */}
            {route.logs && route.logs.length > 0 && (
              <div className="p-8 bg-slate-50/50 border-t border-slate-100">
                <h5 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-6">
                  Itinerario Detallado (Bitácora)
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {route.logs.map((log, lIdx) => (
                    <div
                      key={lIdx}
                      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-slate-800 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase">
                          Día {log.day}
                        </span>
                        {log.is_return && (
                          <span className="bg-emerald-100 text-emerald-600 text-[9px] px-2 py-1 rounded-md font-black uppercase">
                            Retorno a Base
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="text-[11px] text-slate-600 leading-relaxed italic">
                          <i className="fa-solid fa-location-dot text-sunass-blue mr-2"></i>
                          {log.start_location} →{" "}
                          {log.activity_points.join(" → ")} →{" "}
                          {log.final_location}
                        </p>

                        <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[10px]">
                          <span className="font-bold text-slate-400">
                            VIAJE:{" "}
                            <span className="text-slate-700">
                              {log.travel_minutes}m
                            </span>
                          </span>
                          <span className="font-bold text-slate-400">
                            TRABAJO:{" "}
                            <span className="text-slate-700">
                              {log.work_minutes}m
                            </span>
                          </span>
                        </div>

                        {log.note && (
                          <div className="mt-3 bg-amber-50 p-2 rounded-lg text-[9px] text-amber-700 font-medium">
                            <i className="fa-solid fa-circle-info mr-1"></i>{" "}
                            {log.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
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
              {masterPlan?.routes?.map((route, idx) => {
                // Extraemos las coordenadas de los puntos de la ruta
                const pathPositions = route.points
                  .filter((p) => p.lat !== undefined && p.lng !== undefined)
                  .map(
                    (p) => [Number(p.lat), Number(p.lng)] as L.LatLngExpression,
                  );

                if (pathPositions.length < 2) return null;

                return (
                  <Polyline
                    key={`route-line-${route.id || idx}`}
                    positions={pathPositions}
                    pathOptions={{
                      color:
                        route.color || ROUTE_COLORS[idx % ROUTE_COLORS.length],
                      weight: 4,
                      dashArray: "10, 10", // Línea punteada como pediste
                      opacity: 0.8,
                    }}
                  />
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

                {/* 🔥 NUEVO BOTÓN QUE USA EL BACKEND */}
                <button
                  onClick={() => {
                    const sessionId = (window as any).__currentSessionId;
                    if (sessionId) {
                      downloadExcelReport(sessionId);
                    } else {
                      alert("No hay sesión activa. Genera el plan primero.");
                    }
                  }}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
                >
                  Excel (Backend)
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
