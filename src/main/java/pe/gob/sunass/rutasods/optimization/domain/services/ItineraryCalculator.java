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

        DayLog currentLog = startNewDay(currentDay, allPoints.get(currentLocIdx).getName());

        List<Integer> activitiesIndices = pathIndices.subList(1, pathIndices.size());

        for (Integer targetIdx : activitiesIndices) {

            Location targetPoint = allPoints.get(targetIdx);
            int travelTime = (int) timeMatrix[currentLocIdx][targetIdx];

            if (currentTime > 0 &&
                    (currentTime + travelTime) > RoutingRules.MAX_WORK_DAY) {

                closeDay(currentLog, allPoints.get(currentLocIdx).getName(),
                        "Fin de jornada por viaje largo hacia siguiente punto.",
                        currentTime);

                logs.add(currentLog);
                nights++;
                currentDay++;
                currentTime = 0;

                currentLog = startNewDay(currentDay,
                        allPoints.get(currentLocIdx).getName());
            }

            currentTime += travelTime;
            currentLog.setTravelMinutes(
                    currentLog.getTravelMinutes() + travelTime);

            currentLocIdx = targetIdx;

            int baseDuration = targetPoint.getCategory() == Location.Category.OC
                    ? ocDuration
                    : pcDuration;

            List<Integer> tasks = new ArrayList<>();
            tasks.add(baseDuration);

            for (int k = 1; k < targetPoint.getOcCount(); k++) {
                tasks.add(ocDuration);
            }

            for (Integer taskDuration : tasks) {

                System.out.println(
                        "[DAY BREAK] currTime=" + currentTime +
                                " travel=" + travelTime +
                                " task=" + taskDuration +
                                " MAX=" + RoutingRules.MAX_WORK_DAY
                );

                /*Si quieres que el greedy intente exprimir más el día usa MAX_TOTAL_DAY*/
                if (currentTime + taskDuration > RoutingRules.MAX_WORK_DAY) {

                    closeDay(currentLog, targetPoint.getName(),
                            "Cierre de día. Actividades continúan mañana.",
                            currentTime);

                    logs.add(currentLog);

                    nights++;
                    currentDay++;
                    currentTime = 0;

                    currentLog = startNewDay(currentDay,
                            targetPoint.getName());
                }

                currentTime += taskDuration;

                currentLog.setWorkMinutes(
                        currentLog.getWorkMinutes() + taskDuration);

                if (!currentLog.getActivityPoints()
                        .contains(targetPoint.getName())) {
                    currentLog.getActivityPoints()
                            .add(targetPoint.getName());
                }
            }

            currentLog.getActivityOcCounts()
                    .put(targetPoint.getName(),
                            targetPoint.getOcCount());
        }

        // ---- Retorno a ODS ----

        int originIdx = pathIndices.get(0);
        int returnTime = (int) timeMatrix[currentLocIdx][originIdx];

        System.out.println(
                "[RETURN CHECK] currTime=" + currentTime +
                        " return=" + returnTime +
                        " MAX_TOTAL=" + RoutingRules.MAX_TOTAL_DAY
        );

        if (currentTime + returnTime > RoutingRules.MAX_TOTAL_DAY) {

            closeDay(currentLog,
                    allPoints.get(currentLocIdx).getName(),
                    "Pernocte por retorno que excede límite de 11h.",
                    currentTime);

            logs.add(currentLog);

            nights++;
            currentDay++;
            currentTime = 0;

            currentLog = startNewDay(currentDay,
                    allPoints.get(currentLocIdx).getName());
        }

        currentTime += returnTime;

        currentLog.setTravelMinutes(
                currentLog.getTravelMinutes() + returnTime);

        int overtime = Math.max(0,
                currentTime - RoutingRules.MAX_WORK_DAY);

        currentLog.setOvertimeMinutes(
                currentLog.getOvertimeMinutes() + overtime);

        currentLog.setTotalDayMinutes(currentTime);
        currentLog.setFinalLocation("ODS (Retorno)");
        currentLog.setReturn(true);

        currentLog.setNote(
                overtime > 0
                        ? "Retorno finalizado con "
                        + overtime + "min de sobretiempo permitido."
                        : "Retorno exitoso a ODS."
        );

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

    private void closeDay(
            DayLog log,
            String finalLocation,
            String note,
            int totalMinutes
    ) {
        log.setFinalLocation(finalLocation);
        log.setNote(note);
        log.setTotalDayMinutes(totalMinutes);
    }
}
