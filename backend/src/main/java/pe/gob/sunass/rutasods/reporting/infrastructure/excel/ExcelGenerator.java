package pe.gob.sunass.rutasods.reporting.infrastructure.excel;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFDataValidationHelper;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import pe.gob.sunass.rutasods.shared.domain.model.RouteSegment;
import pe.gob.sunass.rutasods.shared.domain.model.DayLog;
import pe.gob.sunass.rutasods.shared.domain.model.Location;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;

@Service
public class ExcelGenerator {

    public byte[] generatePlanMasterExcel(
            List<RouteSegment> routes,
            double[][] distanceMatrix,
            List<String> matrixNames,
            double kmCost,
            double foodCost,
            double hotelCost,
            int pcDuration,
            int ocDuration
    ) {

        try (Workbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("Plan Maestro");

            int rowIdx = 0;

            // Header
            Row header = sheet.createRow(rowIdx++);
            String[] cols = {
                    "Ruta", "Día", "Ubigeo", "Evento",
                    "Detalle", "Actividad 1", "Actividad 2",
                    "Duración (min)", "Costo Estimado (S/.)"
            };

            // Lista para rastrear las filas de evento "Actividad" (para dropdowns)
            List<Integer> activityRowIndices = new ArrayList<>();

            for (int i = 0; i < cols.length; i++) {
                header.createCell(i).setCellValue(cols[i]);
            }

            // Data
            for (RouteSegment r : routes) {
                for (DayLog log : r.getLogs()) {

                    String currentLoc = log.getStartLocation();

                    // 🔥 CALCULAR TIEMPO PROMEDIO POR SEGMENTO DE VIAJE
                    int totalTravelMinutes = log.getTravelMinutes();
                    int travelSegments = countTravelSegments(log);

                    // Si hay retorno, excluir ese segmento del cálculo promedio
                    int adjustedTravelMinutes = totalTravelMinutes;
                    if (log.isReturn()) {
                        // El último segmento es el retorno, lo manejaremos aparte
                        travelSegments = Math.max(1, travelSegments - 1);
                    }

                    // Tiempo promedio por segmento de viaje
                    int avgTravelTime = travelSegments > 0
                            ? adjustedTravelMinutes / travelSegments
                            : 0;

                    for (String pName : log.getActivityPoints()) {

                        // =============== VIAJE ===============
                        if (!pName.equals(currentLoc)) {
                            double dist = findDistance(
                                    currentLoc, pName,
                                    matrixNames, distanceMatrix);

                            double gasCost = dist * kmCost;

                            rowIdx = addRow(sheet, rowIdx,
                                    r.getName(),
                                    log.getDay(),
                                    "-",
                                    "Viaje",
                                    currentLoc + " -> " + pName +
                                            " (" + formatKm(dist) + "km)",
                                    String.valueOf(avgTravelTime), // 🔥 TIEMPO DE VIAJE
                                    gasCost);

                            currentLoc = pName;
                        }

                        // =============== ACTIVIDAD ===============
                        Location pt = r.getPoints().stream()
                                .filter(p -> p.getName().equals(pName))
                                .findFirst()
                                .orElse(null);

                        boolean isOC = pt != null &&
                                pt.getCategory() == Location.Category.OC;

                        int duration = isOC ? ocDuration : pcDuration;

                        String label = isOC
                                ? "Gestión OC"
                                : "Supervisión PC";

                        // ✅ OBTENER UBIGEO
                        String ubigeo = "-";
                        if (pt != null && pt.getUbigeo() != null && !pt.getUbigeo().isEmpty()) {
                            ubigeo = pt.getUbigeo();
                        }

                        activityRowIndices.add(rowIdx); // Guardar índice de fila "Actividad"
                        rowIdx = addRow(sheet, rowIdx,
                                r.getName(),
                                log.getDay(),
                                ubigeo,
                                "Actividad",
                                pName + " (" + label + ")",
                                String.valueOf(duration),
                                0);

                        // =============== OCs ADICIONALES ===============
                        int ocDone =
                                log.getActivityOcCounts()
                                        .getOrDefault(pName, 0);

                        for (int k = 1; k < ocDone; k++) {

                            rowIdx = addRow(sheet, rowIdx,
                                    r.getName(),
                                    log.getDay(),
                                    ubigeo,
                                    "Org. Comunal (Extra)",
                                    pName + " (Capacitación)",
                                    String.valueOf(ocDuration),
                                    10.0);
                        }
                    }

                    // =============== RETORNO / PERNOCTE ===============
                    if (log.isReturn()) {

                        double dist = findDistance(
                                currentLoc,
                                "ODS (Base)",
                                matrixNames,
                                distanceMatrix);

                        double gasCost = dist * kmCost;

                        // 🔥 CALCULAR TIEMPO DE RETORNO
                        // Si conocemos el total de viaje y los segmentos previos,
                        // el retorno es lo que queda
                        int returnTime = totalTravelMinutes - (avgTravelTime * (travelSegments));
                        returnTime = Math.max(0, returnTime); // No permitir negativos

                        rowIdx = addRow(sheet, rowIdx,
                                r.getName(),
                                log.getDay(),
                                "-",
                                "Retorno",
                                currentLoc + " -> ODS (" +
                                        formatKm(dist) + "km)",
                                String.valueOf(returnTime), // 🔥 TIEMPO DE RETORNO
                                gasCost);

                        rowIdx = addRow(sheet, rowIdx,
                                r.getName(),
                                log.getDay(),
                                "-",
                                "Viáticos",
                                "Alimentación Final",
                                "",
                                foodCost);

                    } else {

                        if (log.getFinalLocation() != null &&
                                !log.getFinalLocation()
                                        .equals(currentLoc)) {

                            double dist = findDistance(
                                    currentLoc,
                                    log.getFinalLocation(),
                                    matrixNames,
                                    distanceMatrix);

                            double gasCost = dist * kmCost;

                            rowIdx = addRow(sheet, rowIdx,
                                    r.getName(),
                                    log.getDay(),
                                    "-",
                                    "Viaje (Pernocte)",
                                    currentLoc + " -> " +
                                            log.getFinalLocation() +
                                            " (" + formatKm(dist) + "km)",
                                    String.valueOf(avgTravelTime), // 🔥 TIEMPO DE VIAJE
                                    gasCost);

                            currentLoc = log.getFinalLocation();
                        }

                        double dailyCost = foodCost + hotelCost;

                        rowIdx = addRow(sheet, rowIdx,
                                r.getName(),
                                log.getDay(),
                                "-",
                                "Pernocte",
                                "Hospedaje y Alim. en " +
                                        log.getFinalLocation(),
                                "",
                                dailyCost);
                    }
                }

                rowIdx++; // blank line between routes
            }

            for (int i = 0; i < cols.length; i++) {
                sheet.autoSizeColumn(i);
            }

            // =============== DROPDOWNS PARA ACTIVIDAD 1 Y ACTIVIDAD 2 ===============
            if (!activityRowIndices.isEmpty()) {
                XSSFSheet xssfSheet = (XSSFSheet) sheet;
                XSSFDataValidationHelper dvHelper = new XSSFDataValidationHelper(xssfSheet);

                String[] actividad1Options = {"DF", "DAP"};
                String[] actividad2Options = {"DU", "DRE"};

                for (int actRow : activityRowIndices) {
                    // Dropdown Actividad 1 (columna 5)
                    CellRangeAddressList range1 = new CellRangeAddressList(actRow, actRow, 5, 5);
                    DataValidationConstraint constraint1 = dvHelper.createExplicitListConstraint(actividad1Options);
                    DataValidation validation1 = dvHelper.createValidation(constraint1, range1);
                    validation1.setShowErrorBox(true);
                    xssfSheet.addValidationData(validation1);

                    // Dropdown Actividad 2 (columna 6)
                    CellRangeAddressList range2 = new CellRangeAddressList(actRow, actRow, 6, 6);
                    DataValidationConstraint constraint2 = dvHelper.createExplicitListConstraint(actividad2Options);
                    DataValidation validation2 = dvHelper.createValidation(constraint2, range2);
                    validation2.setShowErrorBox(true);
                    xssfSheet.addValidationData(validation2);
                }
            }

            wb.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Error generating Excel", e);
        }
    }

    // ================= helpers =================

    private int addRow(
            Sheet sheet,
            int rowIdx,
            String route,
            int day,
            String ubigeo,
            String event,
            String detail,
            String duration,
            double cost
    ) {

        Row row = sheet.createRow(rowIdx++);

        row.createCell(0).setCellValue(route);
        row.createCell(1).setCellValue(day);
        row.createCell(2).setCellValue(ubigeo);
        row.createCell(3).setCellValue(event);
        row.createCell(4).setCellValue(detail);
        row.createCell(5).setCellValue("");  // Actividad 1 (vacío por defecto)
        row.createCell(6).setCellValue("");  // Actividad 2 (vacío por defecto)
        row.createCell(7).setCellValue(duration);

        Cell c = row.createCell(8);
        c.setCellValue(cost);

        return rowIdx;
    }

    private double findDistance(
            String from,
            String to,
            List<String> names,
            double[][] matrix
    ) {

        if (to.equals("ODS (Retorno)")) to = "ODS (Base)";

        int i1 = names.indexOf(from);
        int i2 = names.indexOf(to);

        if (i1 >= 0 && i2 >= 0) {
            return matrix[i1][i2];
        }
        return 0;
    }

    /**
     * 🔥 NUEVO MÉTODO: Cuenta la cantidad de segmentos de viaje en un día
     * Un segmento es cada transición entre ubicaciones diferentes
     */
    private int countTravelSegments(DayLog log) {
        int segments = 0;

        // Contar viajes entre puntos de actividad
        String currentLoc = log.getStartLocation();
        for (String activityPoint : log.getActivityPoints()) {
            if (!activityPoint.equals(currentLoc)) {
                segments++;
                currentLoc = activityPoint;
            }
        }

        // Contar viaje de pernocte si existe
        if (!log.isReturn() && log.getFinalLocation() != null
                && !log.getFinalLocation().equals(currentLoc)) {
            segments++;
        }

        // Contar retorno si existe
        if (log.isReturn()) {
            segments++;
        }

        return Math.max(1, segments); // Mínimo 1 para evitar división por cero
    }

    private String formatKm(double v) {
        return String.format("%.2f", v);
    }
}