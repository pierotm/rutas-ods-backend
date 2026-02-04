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

export function downloadMasterPDF(args: {
  masterPlan: MasterPlanResult;
  matrixLocations: Location[];
  distanceMatrix: Matrix;
  costs: { km: number; food: number; hotel: number };
  pcDuration: number;
  ocDuration: number;
}) {
  const { masterPlan, matrixLocations, distanceMatrix, costs } = args;

  const jspdfLib = (window as any).jspdf;
  if (!jspdfLib) {
    alert("La librería PDF no se cargó correctamente. Intenta recargar la página.");
    return;
  }
  const { jsPDF } = jspdfLib;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(0, 85, 150);
  doc.text("Plan Maestro de Rutas ODS", 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado: ${new Date().toLocaleDateString()} | Total Rutas: ${masterPlan.routes.length}`, 14, 26);

  doc.autoTable({
    startY: 32,
    head: [["Costo Total", "Distancia Total", "Noches Total", "Puntos PC", "Puntos OC"]],
    body: [[
      `S/. ${masterPlan.totalSystemCost.toFixed(2)}`,
      `${masterPlan.totalDistance.toFixed(0)} km`,
      masterPlan.totalNights,
      masterPlan.routes.reduce((acc, r) => acc + r.points.filter((p) => p.category === "PC").length, 0),
      masterPlan.routes.reduce((acc, r) => acc + r.points.filter((p) => p.category === "OC").length, 0),
    ]],
    theme: "striped",
    headStyles: { fillColor: [0, 85, 150] },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 10;

  const findDist = (p1Name: string, p2Name: string): number => {
    if (p1Name === "ODS (Retorno)") p1Name = "ODS (Base)";
    if (p2Name === "ODS (Retorno)") p2Name = "ODS (Base)";
    if (!matrixLocations.length || !distanceMatrix.length) return 0;

    const idx1 = matrixLocations.findIndex((m) => m.name === p1Name);
    const idx2 = matrixLocations.findIndex((m) => m.name === p2Name);
    if (idx1 >= 0 && idx2 >= 0) return distanceMatrix[idx1][idx2].value;
    return 0;
  };

  masterPlan.routes.forEach((route) => {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`${route.name} (${route.distance}km - S/.${route.totalCost.toFixed(2)})`, 14, currentY);
    currentY += 5;

    const tableData: any[] = [];
    route.logs.forEach((log) => {
      let currentLoc = log.start_location;

      log.activity_points.forEach((pName) => {
        if (pName !== currentLoc) {
          const dist = findDist(currentLoc, pName);
          const cost = dist * costs.km;
          tableData.push([`Día ${log.day}`, "Viaje", `${currentLoc} -> ${pName}`, "-", `S/. ${cost.toFixed(2)}`]);
          currentLoc = pName;
        }
        const pt = route.points.find((x) => x.name === pName);
        const isOC = pt?.category === "OC";
        const label = isOC ? "Gestión OC" : "Supervisión PC";
        tableData.push([`Día ${log.day}`, "Actividad", `${pName} - ${label}`, "", "S/. 0.00"]);

        const ocCount = log.activity_oc_counts[pName] || 0;
        if (ocCount > 0) {
          tableData.push([`Día ${log.day}`, "Extra", `Capacitación OC (${ocCount})`, "", `S/. ${(ocCount * 10).toFixed(2)}`]);
        }
      });

      if (log.is_return) {
        const dist = findDist(currentLoc, "ODS (Base)");
        const cost = dist * costs.km;
        tableData.push([`Día ${log.day}`, "Retorno", `${currentLoc} -> ODS`, "-", `S/. ${cost.toFixed(2)}`]);
        tableData.push([`Día ${log.day}`, "Viáticos", "Alimentación Final", "-", `S/. ${costs.food.toFixed(2)}`]);
      } else {
        if (log.final_location && log.final_location !== currentLoc) {
          const dist = findDist(currentLoc, log.final_location);
          const cost = dist * costs.km;
          tableData.push([`Día ${log.day}`, "Viaje (Pernocte)", `${currentLoc} -> ${log.final_location}`, "-", `S/. ${cost.toFixed(2)}`]);
          currentLoc = log.final_location;
        }
        tableData.push([`Día ${log.day}`, "Pernocte", `Hotel + Alim en ${log.final_location}`, "-", `S/. ${(costs.food + costs.hotel).toFixed(2)}`]);
      }
    });

    doc.autoTable({
      startY: currentY,
      head: [["Día", "Tipo", "Detalle", "Tiempo", "Costo"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [80, 80, 80] },
      styles: { fontSize: 8 },
      columnStyles: { 2: { cellWidth: 80 } },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  });

  doc.save("Plan_Maestro_Rutas.pdf");
}
