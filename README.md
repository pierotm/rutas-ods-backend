# 🚀 GUÍA COMPLETA: Integración Frontend React + Backend Java

## 📋 Resumen de Cambios

Aplicación actualizada para que utilice el backend Java en lugar de la lógica de optimización en el navegador. Ahora el frontend se comunica con el backend mediante REST API.

---

## 🎯 Archivos Modificados/Creados

### 1️⃣ **`frontend/src/services/backendApi.ts`** (NUEVO)
Servicio para comunicarse con el backend Java:
- `optimizeWithBackend()` - Llama a POST /api/optimize
- `downloadExcelReport()` - Descarga Excel desde el backend
- Tipos TypeScript compatibles con los DTOs de Java

### 2️⃣ **`frontend/src/App.tsx`** (ACTUALIZADO)
Componente principal actualizado:
- ✅ Usa `optimizeWithBackend()` en lugar de cálculos locales
- ✅ Transforma respuesta del backend al formato del frontend
- ✅ Muestra detalles completos de rutas (tiempos, costos, itinerarios)
- ✅ Botón para descargar Excel desde el backend
- ✅ Manejo de sessionId para reportes
- ✅ Sin timeout automático (solo cancelación manual)

---

## 🔧 Cambios Principales en App.tsx

### **ANTES** (Lógica Local):
```typescript
const runMasterPlanOptimization = async () => {
  // Cálculos complejos en el navegador
  // Greedy algorithm, permutaciones, combinaciones
  // calculateItinerary(), getCombinations(), getPermutations()
  // ...
}
```

### **AHORA** (Backend Java):
```typescript
const runMasterPlanOptimization = async () => {
  // 1. Preparar payload
  const payload = {
    ods: { lat, lng },
    points: [...],
    pcDuration,
    ocDuration,
    costs,
    timeFactor
  };

  // 2. Llamar al backend
  const response = await optimizeWithBackend(payload);

  // 3. Transformar respuesta
  const transformedRoutes = response.routes.map(route => ({
    ...route,
    logs: route.logs.map(log => ({
      day: log.day,
      start_location: log.startLocation || log.start_location,
      // ... compatibilidad camelCase/snake_case
    }))
  }));

  // 4. Actualizar estado
  setMasterPlan(masterPlanResult);
  setSessionId(response.sessionId); // Para descargar Excel
}
```

---

## 📊 Transformación de Datos Backend → Frontend

El backend devuelve datos en **camelCase**, pero el frontend usa **snake_case** en algunos lugares. La transformación maneja ambos formatos:

```typescript
logs: (route.logs || []).map((log) => ({
  day: log.day || 1,
  start_location: log.startLocation || log.start_location || "",
  activity_points: log.activityPoints || log.activity_points || [],
  activity_oc_counts: log.activityOcCounts || log.activity_oc_counts || {},
  travel_minutes: log.travelMinutes ?? log.travel_minutes ?? 0,
  work_minutes: log.workMinutes ?? log.work_minutes ?? 0,
  // ...
}))
```

---

## 🎨 Interfaz de Usuario (Sin Cambios Visuales)

La UI mantiene exactamente el mismo diseño que tenías en `index.tsx`:

### ✅ Detalles de Rutas Mostrados:
- **Resumen Global**: Costo total, rutas generadas, puntos PC/OC, distancia, noches
- **Por Ruta**:
  - Nombre, cantidad de puntos, distancia, días, noches, costo
  - Color distintivo para cada ruta
- **Itinerario Detallado** (Tabla):
  - **Día**: Número del día
  - **Itinerario**: Inicio → Puntos visitados → Final/Retorno
  - **Tiempos**: Viaje, trabajo, sobretiempo
  - **Notas**: Explicaciones del sistema

### 📌 Ejemplo de Visualización:

```
┌─────────────────────────────────────────────────────┐
│ Ruta 1 (🔵)                           6 puntos      │
│ 📍 250.5km  📅 3d  🌙 2n  💰 S/. 1,245.50          │
├─────────────────────────────────────────────────────┤
│ Día │ Itinerario                 │ Tiempos │ Notas │
├─────┼────────────────────────────┼─────────┼───────┤
│ 1   │ ODS → P1 → P2 → P3        │ 🚗 120m │ ...   │
│     │                            │ 🛠️ 180m │       │
├─────┼────────────────────────────┼─────────┼───────┤
│ 2   │ P3 → P4 → P5              │ 🚗 90m  │ ...   │
│     │                            │ 🛠️ 180m │       │
│     │                            │ ⏱️ +30m │       │
└─────┴────────────────────────────┴─────────┴───────┘
```

---

## 📥 Descarga de Excel desde el Backend

### **Flujo Completo**:

1. **Usuario genera plan** → Backend calcula y devuelve `sessionId`
2. **Frontend guarda** → `setSessionId(response.sessionId)`
3. **Usuario hace clic en "Excel (Backend)"** → Llama a `downloadExcelReport(sessionId)`
4. **Backend genera Excel** → Endpoint `/api/reports/plan-maestro/excel/{sessionId}`
5. **Frontend descarga** → Archivo `plan_maestro_detallado.xlsx`

### **Código del Botón**:
```tsx
{viewMode === "optimization" && masterPlan && sessionId && (
  <button onClick={handleDownloadExcel}>
    <i className="fa-solid fa-file-excel mr-2"></i>
    Excel (Backend)
  </button>
)}
```

---

## 🚀 Cómo Ejecutar

### **1. Iniciar Backend**
```bash
cd backend
./mvnw spring-boot:run
```
✅ Backend corriendo en: `http://localhost:8081`

### **2. Iniciar Frontend**
```bash
cd frontend
npm run dev
```
✅ Frontend corriendo en: `http://localhost:5173`

### **3. Verificar Conexión**
```bash
# Verificar que el backend responda
curl http://localhost:8081/api/health

# Probar endpoint de optimización (con datos de ejemplo)
curl -X POST http://localhost:8081/api/optimize \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

**¡Listo! La aplicación está conectada al backend y funcionando correctamente.** 🚀
