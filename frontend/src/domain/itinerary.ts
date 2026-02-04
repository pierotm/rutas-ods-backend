import type { DayLog, ItineraryResult, Location } from "./types";
import { MAX_TOTAL_DAY, MAX_WORK_DAY, OC_DURATION } from "../config/constants";

export const calculateItinerary = (
  pathIndices: number[],
  allPoints: Location[],
  timeMatrix: number[][],
  pcDuration: number,
  ocDuration: number
): ItineraryResult => {
  let currentDay = 1;
  let currentTime = 0;
  let currentLocIdx = pathIndices[0];
  let nights = 0;
  const logs: DayLog[] = [];

  const startNewDay = (locationName: string): DayLog => ({
    day: currentDay,
    start_location: locationName,
    activity_points: [],
    activity_oc_counts: {},
    travel_minutes: 0,
    work_minutes: 0,
    overtime_minutes: 0,
    total_day_minutes: 0,
    final_location: "",
    is_return: false,
  });

  let currentLog = startNewDay(allPoints[currentLocIdx].name);
  const activitiesIndices = pathIndices.slice(1);

  for (let i = 0; i < activitiesIndices.length; i++) {
    const targetIdx = activitiesIndices[i];
    const targetPoint = allPoints[targetIdx];
    const travelTime = timeMatrix[currentLocIdx][targetIdx];

    if (currentTime > 0 && currentTime + travelTime > MAX_WORK_DAY) {
      currentLog.final_location = allPoints[currentLocIdx].name;
      currentLog.note = "Fin de jornada por viaje largo hacia siguiente punto.";
      currentLog.total_day_minutes = currentTime;
      logs.push(currentLog);
      nights++;
      currentDay++;
      currentTime = 0;
      currentLog = startNewDay(allPoints[currentLocIdx].name);
    }

    currentTime += travelTime;
    currentLog.travel_minutes += travelTime;
    currentLocIdx = targetIdx;

    const baseDuration = targetPoint.category === "OC" ? ocDuration : pcDuration;
    const tasks: number[] = [baseDuration];
    for (let k = 0; k < targetPoint.ocCount; k++) tasks.push(OC_DURATION);

    for (const taskDuration of tasks) {
      if (currentTime + taskDuration > MAX_WORK_DAY) {
        currentLog.final_location = targetPoint.name;
        currentLog.note = "Cierre de día. Actividades continúan mañana.";
        currentLog.total_day_minutes = currentTime;
        logs.push(currentLog);

        nights++;
        currentDay++;
        currentTime = 0;
        currentLog = startNewDay(targetPoint.name);
      }

      currentTime += taskDuration;
      currentLog.work_minutes += taskDuration;

      if (!currentLog.activity_points.includes(targetPoint.name)) {
        currentLog.activity_points.push(targetPoint.name);
      }
    }

    currentLog.activity_oc_counts[targetPoint.name] = targetPoint.ocCount;
  }

  const originIdx = pathIndices[0];
  const returnTime = timeMatrix[currentLocIdx][originIdx];

  if (currentTime + returnTime > MAX_TOTAL_DAY) {
    currentLog.final_location = allPoints[currentLocIdx].name;
    currentLog.note = "Pernocte por retorno que excede límite de 11h.";
    currentLog.total_day_minutes = currentTime;
    logs.push(currentLog);
    nights++;
    currentDay++;
    currentTime = 0;
    currentLog = startNewDay(allPoints[currentLocIdx].name);
  }

  currentTime += returnTime;
  currentLog.travel_minutes += returnTime;

  const overtime = Math.max(0, currentTime - MAX_WORK_DAY);
  currentLog.overtime_minutes += overtime;
  currentLog.total_day_minutes = currentTime;
  currentLog.final_location = "ODS (Retorno)";
  currentLog.is_return = true;
  currentLog.note =
    overtime > 0
      ? `Retorno finalizado con ${overtime}min de sobretiempo permitido.`
      : "Retorno exitoso a ODS.";

  logs.push(currentLog);
  return { num_days: currentDay, num_nights: nights, logs };
};
