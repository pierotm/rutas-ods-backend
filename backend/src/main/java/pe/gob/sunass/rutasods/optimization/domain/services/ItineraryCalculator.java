package pe.gob.sunass.rutasods.optimization.domain.services;

import pe.gob.sunass.rutasods.shared.domain.model.*;
import pe.gob.sunass.rutasods.shared.domain.rules.RoutingRules;

import java.util.*;

public class ItineraryCalculator {
    private static final int OVERTIME_FOR_PERNOCTE = 60;

    public ItineraryResult calculate(
            List<Integer> pathIndices,
            List<Location> allPoints,
            double[][] timeMatrix,
            int pcDuration,
            int ocDuration
    ) {

        int currentDay = 1;
        int currentTime = 0;

        int currentLocIdx = pathIndices.get(0);
        int nights = 0;

        List<DayLog> logs = new ArrayList<>();

        // El primer punto es siempre el origen (Base ODS)
        DayLog currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());

        List<Integer> activitiesIndices = pathIndices.subList(1, pathIndices.size());

        for (Integer targetIdx : activitiesIndices) {
            Location targetPoint = allPoints.get(targetIdx);
            int travelTime = (int) timeMatrix[currentLocIdx][targetIdx];

            // 1. Validar si el viaje al siguiente punto obliga a cerrar el día
            if (currentTime > 0 && (currentTime + travelTime) > RoutingRules.MAX_WORK_DAY) {

                // 🔥 NUEVA LÓGICA: VERIFICAR SI LA UBICACIÓN ACTUAL ES PC O OC
                Location currentLocation = allPoints.get(currentLocIdx);

                if (currentLocation.getCategory() == Location.Category.OC) {
                    // ❌ NO se puede pernoctar en OC

                    // 🔥 BUSCAR PC: Primero en el día, luego en radio de 5km
                    Integer pcForOvernightIdx = findPcForOvernight(
                            currentLog, allPoints, pathIndices,
                            currentLocIdx, timeMatrix);

                    if (pcForOvernightIdx != null) {
                        // Retroceder/viajar al PC para pernoctar
                        int travelTimeToPc = (int) timeMatrix[currentLocIdx][pcForOvernightIdx];
                        currentTime += travelTimeToPc;
                        currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelTimeToPc);

                        closeDay(currentLog, allPoints.get(pcForOvernightIdx).getName(),
                                "Pernocte en PC cercana (no se permite pernoctar en OC).",
                                currentTime);

                        logs.add(currentLog);
                        nights++;
                        currentDay++;
                        currentTime = 0;

                        // Nuevo día empieza en el PC donde se pernoctó
                        currentLog = startNewDay(currentDay, allPoints.get(pcForOvernightIdx).getName());

                        // Viajar del PC al punto OC donde estábamos
                        int travelFromPcToCurrentOc = (int) timeMatrix[pcForOvernightIdx][currentLocIdx];
                        currentTime += travelFromPcToCurrentOc;
                        currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelFromPcToCurrentOc);

                    } else {
                        // ⚠️ CASO EXCEPCIONAL: No hay PC disponible dentro del radio
                        closeDay(currentLog, allPoints.get(currentLocIdx).getName(),
                                "⚠️ EXCEPCIÓN: Pernocte en OC (no hay PC disponible).",
                                currentTime);

                        logs.add(currentLog);
                        nights++;
                        currentDay++;
                        currentTime = 0;
                        currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());
                    }

                } else {
                    // ✅ La ubicación actual es PC, se puede pernoctar aquí
                    closeDay(currentLog, allPoints.get(currentLocIdx).getName(),
                            "Pernocte en PC por jornada extendida.",
                            currentTime);

                    logs.add(currentLog);
                    nights++;
                    currentDay++;
                    currentTime = 0;
                    currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());
                }
            }

            // Sumar tiempo de viaje
            currentTime += travelTime;
            currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelTime);
            currentLocIdx = targetIdx;

            // 2. Determinar duración de actividades en el punto
            int baseDuration = targetPoint.getCategory() == Location.Category.OC ? ocDuration : pcDuration;

            List<Integer> tasks = new ArrayList<>();
            tasks.add(baseDuration);
            // Agregar OCs adicionales si existen
            for (int k = 1; k < targetPoint.getOcCount(); k++) {
                tasks.add(ocDuration);
            }

            // 3. Procesar tareas en el punto (puede desbordar al día siguiente)
            for (Integer taskDuration : tasks) {
                if (currentTime + taskDuration > RoutingRules.MAX_WORK_DAY) {

                    // 🔥 NUEVA LÓGICA: VERIFICAR SI EL PUNTO ACTUAL ES PC O OC
                    if (targetPoint.getCategory() == Location.Category.OC) {
                        // ❌ NO se puede pernoctar en OC

                        Integer pcForOvernightIdx = findPcForOvernight(
                                currentLog, allPoints, pathIndices,
                                currentLocIdx, timeMatrix);

                        if (pcForOvernightIdx != null) {
                            // Retroceder al PC
                            int travelTimeToPc = (int) timeMatrix[currentLocIdx][pcForOvernightIdx];
                            currentTime += travelTimeToPc;
                            currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelTimeToPc);

                            closeDay(currentLog, allPoints.get(pcForOvernightIdx).getName(),
                                    "Pernocte en PC cercana. Actividades de OC continúan mañana.",
                                    currentTime);

                            logs.add(currentLog);
                            nights++;
                            currentDay++;
                            currentTime = 0;

                            // Nuevo día en PC
                            currentLog = startNewDay(currentDay, allPoints.get(pcForOvernightIdx).getName());

                            // Viajar del PC al OC para continuar actividades
                            int travelFromPcToOc = (int) timeMatrix[pcForOvernightIdx][targetIdx];
                            currentTime += travelFromPcToOc;
                            currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelFromPcToOc);

                        } else {
                            // Caso excepcional: no hay PC
                            closeDay(currentLog, targetPoint.getName(),
                                    "⚠️ EXCEPCIÓN: Pernocte en OC (no hay PC cercana). Actividades continúan mañana.",
                                    currentTime);

                            logs.add(currentLog);
                            nights++;
                            currentDay++;
                            currentTime = 0;
                            currentLog = startNewDay(currentDay, targetPoint.getName());
                        }

                    } else {
                        // ✅ Es PC, pernocte normal
                        closeDay(currentLog, targetPoint.getName(),
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

                // Registrar que se trabajó en este punto este día
                if (!currentLog.getActivityPoints().contains(targetPoint.getName())) {
                    currentLog.getActivityPoints().add(targetPoint.getName());
                }
            }

            // Guardar conteo de OCs para el badge de la UI (+1 OC, etc)
            currentLog.getActivityOcCounts().put(targetPoint.getName(), targetPoint.getOcCount());
        }

        // ---- 4. Lógica de Retorno a ODS ----
        int originIdx = pathIndices.get(0);
        int returnTime = (int) timeMatrix[currentLocIdx][originIdx];

        // Validar si el retorno cabe en el límite extendido (11h / 660min)
        if (currentTime + returnTime > RoutingRules.MAX_TOTAL_DAY) {

            // 🔥 NUEVA LÓGICA: VERIFICAR SI UBICACIÓN ACTUAL ES PC O OC
            Location currentLocation = allPoints.get(currentLocIdx);

            if (currentLocation.getCategory() == Location.Category.OC) {
                // ❌ NO se puede pernoctar en OC

                Integer pcForOvernightIdx = findPcForOvernight(
                        currentLog, allPoints, pathIndices,
                        currentLocIdx, timeMatrix);

                if (pcForOvernightIdx != null) {
                    // Retroceder al PC
                    int travelTimeToPc = (int) timeMatrix[currentLocIdx][pcForOvernightIdx];
                    currentTime += travelTimeToPc;
                    currentLog.setTravelMinutes(currentLog.getTravelMinutes() + travelTimeToPc);

                    closeDay(currentLog, allPoints.get(pcForOvernightIdx).getName(),
                            "Pernocte en PC cercana antes del retorno final (no se permite pernoctar en OC).",
                            currentTime);

                    logs.add(currentLog);
                    nights++;
                    currentDay++;
                    currentTime = 0;

                    // Nuevo día en PC, listo para retornar a ODS
                    currentLog = startNewDay(currentDay, allPoints.get(pcForOvernightIdx).getName());
                    currentLocIdx = pcForOvernightIdx;
                    returnTime = (int) timeMatrix[pcForOvernightIdx][originIdx];

                } else {
                    // Caso excepcional: pernoctar en OC
                    closeDay(currentLog, allPoints.get(currentLocIdx).getName(),
                            "⚠️ EXCEPCIÓN: Pernocte en OC antes de retorno (no hay PC cercana a la OC).",
                            currentTime);

                    logs.add(currentLog);
                    nights++;
                    currentDay++;
                    currentTime = 0;
                    currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());
                }

            } else {
                // ✅ Es PC, pernocte normal antes del retorno
                closeDay(currentLog, allPoints.get(currentLocIdx).getName(),
                        "Pernocte en PC antes del retorno final.",
                        currentTime);

                logs.add(currentLog);
                nights++;
                currentDay++;
                currentTime = 0;
                currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());
            }
        }

        currentTime += returnTime;
        currentLog.setTravelMinutes(currentLog.getTravelMinutes() + returnTime);

        // Calcular sobretiempo final del día de retorno
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

    // ================== Helpers privados ==================

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

        // Calcular sobretiempo de la jornada (si excede MAX_WORK_DAY)
        int overtime = Math.max(0, totalMinutes - RoutingRules.MAX_WORK_DAY);
        log.setOvertimeMinutes(overtime);
    }

    /**
     * 🔥 NUEVO MÉTODO MEJORADO: Encuentra un PC para pernoctar
     *
     * Estrategia:
     * 1. Busca el último PC visitado en el día actual
     * 2. Si no hay, busca el PC más cercano dentro de un radio de 5km
     *
     * @param currentLog El log del día actual
     * @param allPoints Lista de todos los puntos
     * @param pathIndices Ruta completa
     * @param currentLocationIdx Índice de la ubicación actual (OC)
     * @param distanceMatrix Matriz de distancias
     * @return Índice del PC para pernoctar, o null si no hay ninguno disponible
     */
    private Integer findPcForOvernight(
            DayLog currentLog,
            List<Location> allPoints,
            List<Integer> pathIndices,
            int currentLocationIdx,
            double[][] distanceMatrix
    ) {
        // Estrategia: Buscar el PC más cercano en TODA la ruta actual, sin límites de radio
        Integer nearestPcIdx = null;
        double minDistance = Double.MAX_VALUE;

        for (int idx : pathIndices) {
            Location point = allPoints.get(idx);

            // REGLA ESTRICTA: Solo categoría PC y que NO sea el origen (índice 0)
            if (point.getCategory() == Location.Category.PC && idx != 0) {
                double distance = distanceMatrix[currentLocationIdx][idx];
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPcIdx = idx;
                }
            }
        }
        return nearestPcIdx;
    }

    /**
     * Encuentra el último punto PC visitado en el día actual
     * @return Índice del último PC visitado en el día, o null si no hay ninguno
     */
    private Integer findLastPcInDay(DayLog currentLog, List<Location> allPoints, List<Integer> pathIndices) {
        // Buscar en los puntos de actividad del día actual (en orden inverso)
        List<String> activityPoints = currentLog.getActivityPoints();

        for (int i = activityPoints.size() - 1; i >= 0; i--) {
            String pointName = activityPoints.get(i);

            // Buscar este punto en allPoints
            Location point = allPoints.stream()
                    .filter(p -> p.getName().equals(pointName))
                    .findFirst()
                    .orElse(null);

            if (point != null && point.getCategory() == Location.Category.PC) {
                // Encontrar el índice de este punto en pathIndices
                for (int idx : pathIndices) {
                    if (allPoints.get(idx).getName().equals(pointName)) {
                        return idx;
                    }
                }
            }
        }

        return null;
    }

    /**
     * 🔥 NUEVO MÉTODO: Busca el PC más cercano dentro de un radio de 5km
     *
     * @param currentLocationIdx Índice de la ubicación actual (OC)
     * @param allPoints Lista de todos los puntos
     * @param pathIndices Ruta completa
     * @param distanceMatrix Matriz de distancias
     * @return Índice del PC más cercano dentro del radio, o null si no hay ninguno
     */
    private Integer findNearestPcWithinRadius(
            int currentLocationIdx,
            List<Location> allPoints,
            List<Integer> pathIndices,
            double[][] distanceMatrix
    ) {
        Integer nearestPcIdx = null;
        double minDistance = Double.MAX_VALUE;

        for (int idx : pathIndices) {
            Location point = allPoints.get(idx);
            if (point.getCategory() != Location.Category.PC) continue;

            double distance = distanceMatrix[currentLocationIdx][idx];
            // Eliminamos la condición: distance <= PC_SEARCH_RADIUS_KM
            if (distance < minDistance) {
                minDistance = distance;
                nearestPcIdx = idx;
            }
        }
        return nearestPcIdx;
    }
}