package pe.gob.sunass.rutasods.optimization.domain.services;

import pe.gob.sunass.rutasods.shared.domain.model.*;
import pe.gob.sunass.rutasods.shared.domain.rules.RoutingRules;

import java.util.*;

/**
 * Calcula el itinerario día a día para una ruta dada.
 *
 * REGLAS DE PERNOCTE:
 *  - Solo se puede pernoctar en un punto de categoría PC.
 *  - NO se puede pernoctar en la ODS (índice 0, origen/retorno final).
 *  - NO se puede pernoctar en una OC; en ese caso se busca la PC más cercana.
 *  - La ODS es únicamente el punto de retorno al final del viaje.
 */
public class ItineraryCalculator {

    public ItineraryResult calculate(
            List<Integer> pathIndices,
            List<Location> allPoints,
            double[][] timeMatrix,
            int pcDuration,
            int ocDuration
    ) {

        int currentDay = 1;
        int currentTime = 0;

        int currentLocIdx = pathIndices.get(0); // siempre es el ODS (índice 0)
        int nights = 0;

        List<DayLog> logs = new ArrayList<>();

        DayLog currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());

        List<Integer> activitiesIndices = pathIndices.subList(1, pathIndices.size());

        for (Integer targetIdx : activitiesIndices) {
            Location targetPoint = allPoints.get(targetIdx);
            int travelTime = (int) timeMatrix[currentLocIdx][targetIdx];

            // ── 1. ¿El viaje al siguiente punto desborda la jornada? ──────────────
            if (currentTime > 0 && (currentTime + travelTime) > RoutingRules.MAX_WORK_DAY) {

                Location currentLocation = allPoints.get(currentLocIdx);

                if (currentLocation.getCategory() == Location.Category.OC
                        || currentLocIdx == 0) {
                    // Ubicación actual es OC (o, por seguridad, ODS): buscar PC para pernoctar
                    Integer pcIdx = findNearestPcForOvernight(
                            allPoints, pathIndices, currentLocIdx, timeMatrix);

                    if (pcIdx != null) {
                        int travelToPc = (int) timeMatrix[currentLocIdx][pcIdx];
                        currentTime += travelToPc;
                        currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelToPc);

                        closeDay(currentLog,
                                allPoints.get(pcIdx).getName(),
                                "Pernocte en PC cercana (no se permite pernoctar en OC ni en ODS).",
                                currentTime);
                        logs.add(currentLog);
                        nights++;
                        currentDay++;
                        currentTime = 0;

                        // El nuevo día arranca desde la PC donde se pernoctó
                        currentLog = startNewDay(currentDay, allPoints.get(pcIdx).getName());

                        // Viajar de vuelta al punto OC donde estábamos
                        int travelBackToOc = (int) timeMatrix[pcIdx][currentLocIdx];
                        currentTime += travelBackToOc;
                        currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelBackToOc);

                    } else {
                        // Sin PC disponible en ningún punto de la ruta → excepción inevitable
                        closeDay(currentLog,
                                allPoints.get(currentLocIdx).getName(),
                                "⚠️ EXCEPCIÓN: Sin PC disponible; pernocte forzado en OC.",
                                currentTime);
                        logs.add(currentLog);
                        nights++;
                        currentDay++;
                        currentTime = 0;
                        currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());
                    }

                } else {
                    // Ubicación actual es PC → pernocte normal
                    closeDay(currentLog,
                            allPoints.get(currentLocIdx).getName(),
                            "Pernocte en PC por jornada extendida.",
                            currentTime);
                    logs.add(currentLog);
                    nights++;
                    currentDay++;
                    currentTime = 0;
                    currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());
                }
            }

            // ── 2. Sumar tiempo de viaje al punto objetivo ────────────────────────
            currentTime += travelTime;
            currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelTime);
            currentLocIdx = targetIdx;

            // ── 3. Procesar tareas en el punto objetivo ───────────────────────────
            int baseDuration = (targetPoint.getCategory() == Location.Category.OC)
                    ? ocDuration : pcDuration;

            List<Integer> tasks = new ArrayList<>();
            tasks.add(baseDuration);
            for (int k = 1; k < targetPoint.getOcCount(); k++) {
                tasks.add(ocDuration);
            }

            for (Integer taskDuration : tasks) {
                if (currentTime + taskDuration > RoutingRules.MAX_WORK_DAY) {

                    if (targetPoint.getCategory() == Location.Category.OC) {
                        // Punto objetivo es OC → buscar PC para pernoctar
                        Integer pcIdx = findNearestPcForOvernight(
                                allPoints, pathIndices, currentLocIdx, timeMatrix);

                        if (pcIdx != null) {
                            int travelToPc = (int) timeMatrix[currentLocIdx][pcIdx];
                            currentTime += travelToPc;
                            currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelToPc);

                            closeDay(currentLog,
                                    allPoints.get(pcIdx).getName(),
                                    "Pernocte en PC cercana. Actividades de OC continúan mañana.",
                                    currentTime);
                            logs.add(currentLog);
                            nights++;
                            currentDay++;
                            currentTime = 0;

                            currentLog = startNewDay(currentDay, allPoints.get(pcIdx).getName());

                            int travelFromPcToOc = (int) timeMatrix[pcIdx][targetIdx];
                            currentTime += travelFromPcToOc;
                            currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelFromPcToOc);

                        } else {
                            closeDay(currentLog,
                                    targetPoint.getName(),
                                    "⚠️ EXCEPCIÓN: Sin PC disponible; pernocte forzado en OC. Actividades continúan mañana.",
                                    currentTime);
                            logs.add(currentLog);
                            nights++;
                            currentDay++;
                            currentTime = 0;
                            currentLog = startNewDay(currentDay, targetPoint.getName());
                        }

                    } else {
                        // Punto objetivo es PC → pernocte normal
                        closeDay(currentLog,
                                targetPoint.getName(),
                                "Pernocte en PC. Actividades continúan mañana.",
                                currentTime);
                        logs.add(currentLog);
                        nights++;
                        currentDay++;
                        currentTime = 0;
                        currentLog = startNewDay(currentDay, targetPoint.getName());
                    }
                }

                currentTime += taskDuration;
                currentLog.setWorkMinutes(currentLog.getWorkMinutes() + taskDuration);

                if (!currentLog.getActivityPoints().contains(targetPoint.getName())) {
                    currentLog.getActivityPoints().add(targetPoint.getName());
                }
            }

            currentLog.getActivityOcCounts().put(targetPoint.getName(), targetPoint.getOcCount());
        }

        // ── 4. Retorno a ODS ──────────────────────────────────────────────────────
        //
        // REGLA: La ODS es únicamente destino final; NO es punto de pernocte.
        // Si el retorno excede MAX_TOTAL_DAY, hay que pernoctar en una PC
        // y retornar al día siguiente.
        //
        int originIdx = pathIndices.get(0); // índice 0 = ODS
        int returnTime = (int) timeMatrix[currentLocIdx][originIdx];

        if (currentTime + returnTime > RoutingRules.MAX_TOTAL_DAY) {

            Location currentLocation = allPoints.get(currentLocIdx);

            if (currentLocation.getCategory() == Location.Category.OC
                    || currentLocIdx == 0) {
                // Estamos en OC (o en la propia ODS, situación anómala):
                // buscar PC para pernoctar antes del retorno.
                Integer pcIdx = findNearestPcForOvernight(
                        allPoints, pathIndices, currentLocIdx, timeMatrix);

                if (pcIdx != null) {
                    int travelToPc = (int) timeMatrix[currentLocIdx][pcIdx];
                    currentTime += travelToPc;
                    currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelToPc);

                    closeDay(currentLog,
                            allPoints.get(pcIdx).getName(),
                            "Pernocte en PC antes del retorno final (no se permite pernoctar en OC ni en ODS).",
                            currentTime);
                    logs.add(currentLog);
                    nights++;
                    currentDay++;
                    currentTime = 0;

                    // Nuevo día desde la PC; recalcular tiempo de retorno a ODS
                    currentLog = startNewDay(currentDay, allPoints.get(pcIdx).getName());
                    currentLocIdx = pcIdx;
                    returnTime = (int) timeMatrix[pcIdx][originIdx];

                } else {
                    // Sin PC → cerrar día en OC (excepción inevitable)
                    closeDay(currentLog,
                            allPoints.get(currentLocIdx).getName(),
                            "⚠️ EXCEPCIÓN: Sin PC disponible; pernocte forzado en OC antes del retorno.",
                            currentTime);
                    logs.add(currentLog);
                    nights++;
                    currentDay++;
                    currentTime = 0;
                    currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());
                    returnTime = (int) timeMatrix[currentLocIdx][originIdx];
                }

            } else {
                // Estamos en una PC → pernocte normal antes del retorno
                closeDay(currentLog,
                        allPoints.get(currentLocIdx).getName(),
                        "Pernocte en PC antes del retorno final.",
                        currentTime);
                logs.add(currentLog);
                nights++;
                currentDay++;
                currentTime = 0;
                currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());
            }
        }

        // ── 5. Día de retorno ─────────────────────────────────────────────────────
        currentTime += returnTime;
        currentLog.setTravelMinutes(currentLog.getTravelMinutes() + returnTime);

        int overtime = Math.max(0, currentTime - RoutingRules.MAX_WORK_DAY);
        currentLog.setOvertimeMinutes(overtime);
        currentLog.setTotalDayMinutes(currentTime);
        currentLog.setFinalLocation("ODS (Retorno)");
        currentLog.setReturn(true);
        currentLog.setNote(overtime > 0
                ? "Retorno finalizado con " + overtime + "min de sobretiempo permitido."
                : "Retorno exitoso a base ODS.");

        logs.add(currentLog);

        return new ItineraryResult(currentDay, nights, logs);
    }

    // ═══════════════════════════ Helpers privados ════════════════════════════

    private DayLog startNewDay(int day, String locationName) {
        DayLog log = new DayLog();
        log.setDay(day);
        log.setStartLocation(locationName);
        log.setActivityPoints(new ArrayList<>());
        log.setActivityOcCounts(new HashMap<>());
        log.setTravelMinutes(0);
        log.setWorkMinutes(0);
        log.setOvertimeMinutes(0);
        log.setTotalDayMinutes(0);
        log.setFinalLocation("");
        log.setReturn(false);
        return log;
    }

    private void closeDay(DayLog log, String finalLocation, String note, int totalMinutes) {
        log.setFinalLocation(finalLocation);
        log.setNote(note);
        log.setTotalDayMinutes(totalMinutes);
        int overtime = Math.max(0, totalMinutes - RoutingRules.MAX_WORK_DAY);
        log.setOvertimeMinutes(overtime);
    }

    /**
     * Busca la PC más cercana donde se pueda pernoctar.
     *
     * Estrategia en dos pasos:
     *   1. Buscar entre los índices del path actual (excluyendo ODS = índice 0).
     *   2. Si no hay ninguna, buscar en TODOS los puntos del sistema
     *      (también excluyendo ODS = índice 0).
     *
     * Nunca devuelve el índice 0 (ODS).
     */
    private Integer findNearestPcForOvernight(
            List<Location> allPoints,
            List<Integer> pathIndices,
            int currentLocationIdx,
            double[][] distanceMatrix
    ) {
        Integer nearestPcIdx = null;
        double minDistance = Double.MAX_VALUE;

        // ── Paso 1: buscar en los puntos del path (sin ODS) ─────────────────
        for (int idx : pathIndices) {
            if (idx == 0) continue; // ODS excluida explícitamente
            Location point = allPoints.get(idx);
            if (point.getCategory() != Location.Category.PC) continue;

            double dist = distanceMatrix[currentLocationIdx][idx];
            if (dist < minDistance) {
                minDistance = dist;
                nearestPcIdx = idx;
            }
        }

        if (nearestPcIdx != null) return nearestPcIdx;

        // ── Paso 2: fallback — buscar en TODOS los puntos (sin ODS) ─────────
        for (int idx = 1; idx < allPoints.size(); idx++) {
            Location point = allPoints.get(idx);
            if (point.getCategory() != Location.Category.PC) continue;

            // Verificar que la fila/columna exista en la matriz
            if (currentLocationIdx >= distanceMatrix.length
                    || idx >= distanceMatrix[currentLocationIdx].length) continue;

            double dist = distanceMatrix[currentLocationIdx][idx];
            if (dist < minDistance) {
                minDistance = dist;
                nearestPcIdx = idx;
            }
        }

        return nearestPcIdx; // null si no existe ninguna PC en todo el sistema
    }

    // ── Métodos legacy mantenidos por compatibilidad (no se usan internamente) ──

    @Deprecated
    private Integer findLastPcInDay(DayLog currentLog, List<Location> allPoints,
                                    List<Integer> pathIndices) {
        List<String> activityPoints = currentLog.getActivityPoints();
        for (int i = activityPoints.size() - 1; i >= 0; i--) {
            String pointName = activityPoints.get(i);
            Location point = allPoints.stream()
                    .filter(p -> p.getName().equals(pointName))
                    .findFirst().orElse(null);
            if (point != null && point.getCategory() == Location.Category.PC) {
                for (int idx : pathIndices) {
                    if (allPoints.get(idx).getName().equals(pointName)) return idx;
                }
            }
        }
        return null;
    }

    @Deprecated
    private Integer findNearestPcWithinRadius(int currentLocationIdx,
                                              List<Location> allPoints,
                                              List<Integer> pathIndices,
                                              double[][] distanceMatrix) {
        return findNearestPcForOvernight(allPoints, pathIndices,
                currentLocationIdx, distanceMatrix);
    }
}