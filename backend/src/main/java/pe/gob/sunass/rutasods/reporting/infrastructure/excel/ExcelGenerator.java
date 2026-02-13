package pe.gob.sunass.rutasods.reporting.infrastructure.excel;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import pe.gob.sunass.rutasods.shared.domain.model.RouteSegment;
import pe.gob.sunass.rutasods.shared.domain.model.DayLog;
import pe.gob.sunass.rutasods.shared.domain.model.Location;

import java.io.ByteArrayOutputStream;
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

            // Header - ✅ COLUMNA UBIGEO
            Row header = sheet.createRow(rowIdx++);
            String[] cols = {
                    "Ruta", "Día", "Ubigeo", "Evento",
                    "Detalle", "Duración (min)",
                    "Costo Estimado (S/.)"
            };

            for (int i = 0; i < cols.length; i++) {
                header.createCell(i).setCellValue(cols[i]);
            }

            // Data
            for (RouteSegment r : routes) {
                for (DayLog log : r.getLogs()) {

                    String currentLoc = log.getStartLocation();

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
                                    "-", // ✅ Sin UBIGEO en viajes
                                    "Viaje",
                                    currentLoc + " -> " + pName +
                                            " (" + formatKm(dist) + "km)",
                                    "",
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

                        // ✅ OBTENER UBIGEO del punto actual donde se realiza la actividad
                        String ubigeo = "-";
                        if (pt != null && pt.getUbigeo() != null && !pt.getUbigeo().isEmpty()) {
                            ubigeo = pt.getUbigeo();
                        }

                        rowIdx = addRow(sheet, rowIdx,
                                r.getName(),
                                log.getDay(),
                                ubigeo, // ✅ UBIGEO solo en actividad
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
                                    ubigeo, // ✅ Mismo UBIGEO para OCs adicionales del mismo punto
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

                        rowIdx = addRow(sheet, rowIdx,
                                r.getName(),
                                log.getDay(),
                                "-", // ✅ Sin UBIGEO en retornos
                                "Retorno",
                                currentLoc + " -> ODS (" +
                                        formatKm(dist) + "km)",
                                "",
                                gasCost);

                        rowIdx = addRow(sheet, rowIdx,
                                r.getName(),
                                log.getDay(),
                                "-", // ✅ Sin UBIGEO en viáticos
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
                                    "-", // ✅ Sin UBIGEO en viajes de pernocte
                                    "Viaje (Pernocte)",
                                    currentLoc + " -> " +
                                            log.getFinalLocation() +
                                            " (" + formatKm(dist) + "km)",
                                    "",
                                    gasCost);

                            currentLoc = log.getFinalLocation();
                        }

                        double dailyCost = foodCost + hotelCost;

                        rowIdx = addRow(sheet, rowIdx,
                                r.getName(),
                                log.getDay(),
                                "-", // ✅ Sin UBIGEO en pernocte
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
            String ubigeo, // ✅ PARÁMETRO UBIGEO
            String event,
            String detail,
            String duration,
            double cost
    ) {

        Row row = sheet.createRow(rowIdx++);

        row.createCell(0).setCellValue(route);
        row.createCell(1).setCellValue(day);
        row.createCell(2).setCellValue(ubigeo); // ✅ COLUMNA UBIGEO
        row.createCell(3).setCellValue(event);
        row.createCell(4).setCellValue(detail);
        row.createCell(5).setCellValue(duration);

        Cell c = row.createCell(6); // ✅ AJUSTADO ÍNDICE
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

    private String formatKm(double v) {
        return String.format("%.2f", v);
    }
}