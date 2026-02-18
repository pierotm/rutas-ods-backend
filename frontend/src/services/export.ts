import type { MasterPlanResult, Matrix, Location } from "../domain/types";

export function downloadMasterCSV(args: {
  masterPlan: MasterPlanResult;
  matrixLocations: Location[];
  distanceMatrix: Matrix;
  costs: { km: number; food: number; hotel: number };
  pcDuration: number;
  ocDuration: number;
}) {
  const { masterPlan, matrixLocations, distanceMatrix, costs, pcDuration, ocDuration } = args;

  const findDist = (p1Name: string, p2Name: string): number => {
    if (p1Name === "ODS (Retorno)") p1Name = "ODS (Base)";
    if (p2Name === "ODS (Retorno)") p2Name = "ODS (Base)";
    if (!matrixLocations.length || !distanceMatrix.length) return 0;

    const idx1 = matrixLocations.findIndex((m) => m.name === p1Name);
    const idx2 = matrixLocations.findIndex((m) => m.name === p2Name);
    if (idx1 >= 0 && idx2 >= 0) return distanceMatrix[idx1][idx2].value;
    return 0;
  };

  let csv = "\ufeffRuta,Día,Evento,Detalle,Duración (min),Costo Estimado (S/.)\n";

  masterPlan.routes.forEach((r) => {
    r.logs.forEach((log) => {
      let currentLoc = log.start_location;

      log.activity_points.forEach((pName) => {
        if (pName !== currentLoc) {
          const dist = findDist(currentLoc, pName);
          const gasCost = dist * costs.km;
          csv += `${r.name},${log.day},Viaje,${currentLoc} -> ${pName} (${dist}km),-,${gasCost.toFixed(2)}\n`;
          currentLoc = pName;
        }

        const pt = r.points.find((point) => point.name === pName);
        const isOC = pt?.category === "OC";
        const duration = isOC ? ocDuration : pcDuration;
        const label = isOC ? "Gestión OC" : "Supervisión PC";
        csv += `${r.name},${log.day},Actividad,${pName} (${label}),${duration},0.00\n`;

        const ocDone = log.activity_oc_counts[pName] || 0;
        for (let k = 0; k < ocDone; k++) {
          csv += `${r.name},${log.day},Org. Comunal (Extra),${pName} (Capacitación),300,10.00\n`;
        }
      });

      if (log.is_return) {
        const dist = findDist(currentLoc, "ODS (Base)");
        const gasCost = dist * costs.km;
        csv += `${r.name},${log.day},Retorno,${currentLoc} -> ODS (${dist}km),-,${gasCost.toFixed(2)}\n`;
        csv += `${r.name},${log.day},Viáticos,Alimentación Final,-,${costs.food.toFixed(2)}\n`;
      } else {
        if (log.final_location && log.final_location !== currentLoc) {
          const dist = findDist(currentLoc, log.final_location);
          const gasCost = dist * costs.km;
          csv += `${r.name},${log.day},Viaje (Pernocte),${currentLoc} -> ${log.final_location} (${dist}km),-,${gasCost.toFixed(2)}\n`;
          currentLoc = log.final_location;
        }
        const dailyCost = costs.food + costs.hotel;
        csv += `${r.name},${log.day},Pernocte,Hospedaje y Alim. en ${log.final_location},-,${dailyCost.toFixed(2)}\n`;
      }
    });
    csv += `,,,,,,\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `plan_maestro_detallado.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Descarga el PDF del plan maestro desde el backend usando sessionId
 * @param sessionId ID de la sesión de optimización
 */
export const downloadMasterPDF = async (sessionId: string): Promise<void> => {
  try {
    const response = await fetch(`/api/reports/plan-maestro/pdf/${sessionId}`);
    
    if (!response.ok) {
      throw new Error(`Error al descargar PDF: ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Plan_Maestro_Rutas_${new Date().getTime()}.pdf`);
    document.body.appendChild(link);
    link.click();
    
    // Limpieza
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error al descargar el PDF:", error);
    throw error;
  }
};

export const downloadMatrixExcel = async (sessionId: string): Promise<void> => {
  try {
    // Asegúrate de que esta URL coincida con el @RequestMapping de ReportController en el backend
    const response = await fetch(`/api/reports/matriz/excel/${sessionId}`);

    if (!response.ok) {
      throw new Error(`Error al descargar Excel: ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Matriz_Distancias_${sessionId}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error al descargar el Excel de la matriz:", error);
    throw error;
  }
};