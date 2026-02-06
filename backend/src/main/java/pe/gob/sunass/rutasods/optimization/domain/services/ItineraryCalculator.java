package pe.gob.sunass.rutasods.optimization.domain.services;

import pe.gob.sunass.rutasods.shared.domain.model.*;
import pe.gob.sunass.rutasods.shared.domain.rules.RoutingRules;

import java.util.*;

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

        int currentLocIdx = pathIndices.get(0);
        int nights = 0;

        List<DayLog> logs = new ArrayList<>();

        // El primer punto es siempre el origen (Base ODS)
        DayLog currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());

        List<Integer> activitiesIndices = pathIndices.subList(1, pathIndices.size());

        for (Integer targetIdx : activitiesIndices) {
            Location targetPoint = allPoints.get(targetIdx);
            int travelTime = (int) timeMatrix[currentLocIdx][targetIdx];

            // 1. Validar si el viaje al siguiente punto obliga a cerrar el día (Lógica index.tsx)
            if (currentTime > 0 && (currentTime + travelTime) > RoutingRules.MAX_WORK_DAY) {
                closeDay(currentLog, allPoints.get(currentLocIdx).getName(),
                        "Fin de jornada por viaje largo hacia siguiente punto.",
                        currentTime);

                logs.add(currentLog);
                nights++;
                currentDay++;
                currentTime = 0;
                currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());
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
                    closeDay(currentLog, targetPoint.getName(),
                            "Cierre de día. Actividades continúan mañana.",
                            currentTime);

                    logs.add(currentLog);
                    nights++;
                    currentDay++;
                    currentTime = 0;
                    currentLog = startNewDay(currentDay, targetPoint.getName());
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

        // ---- 4. Lógica de Retorno a ODS (Reflejando index.tsx) ----
        int originIdx = pathIndices.get(0);
        int returnTime = (int) timeMatrix[currentLocIdx][originIdx];

        // Validar si el retorno cabe en el límite extendido (11h / 660min)
        if (currentTime + returnTime > RoutingRules.MAX_TOTAL_DAY) {
            closeDay(currentLog,
                    allPoints.get(currentLocIdx).getName(),
                    "Pernocte por retorno que excede límite de jornada extendida.",
                    currentTime);

            logs.add(currentLog);
            nights++;
            currentDay++;
            currentTime = 0;
            currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());
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
}