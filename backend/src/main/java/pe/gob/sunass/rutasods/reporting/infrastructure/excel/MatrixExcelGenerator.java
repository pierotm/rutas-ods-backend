package pe.gob.sunass.rutasods.reporting.infrastructure.excel;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.List;

@Service
public class MatrixExcelGenerator {

    public byte[] generateMatrixExcel(
            double[][] distanceMatrix,
            double[][] durationMatrix,
            List<String> pointNames
    ) {

        try (Workbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // ==================== HOJA 1: MATRIZ DE DISTANCIAS ====================
            Sheet distSheet = wb.createSheet("Distancias (km)");
            createMatrixSheet(distSheet, distanceMatrix, pointNames, "Distancias en Kilómetros", "km");

            // ==================== HOJA 2: MATRIZ DE TIEMPOS ====================
            Sheet timeSheet = wb.createSheet("Tiempos (min)");
            createMatrixSheet(timeSheet, durationMatrix, pointNames, "Tiempos en Minutos", "min");

            wb.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Error generating Matrix Excel", e);
        }
    }

    private void createMatrixSheet(
            Sheet sheet,
            double[][] matrix,
            List<String> pointNames,
            String title,
            String unit
    ) {
        int rowIdx = 0;

        // Estilos
        CellStyle headerStyle = sheet.getWorkbook().createCellStyle();
        Font headerFont = sheet.getWorkbook().createFont();
        headerFont.setBold(true);
        headerFont.setColor(IndexedColors.WHITE.getIndex());
        headerStyle.setFont(headerFont);
        headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        headerStyle.setAlignment(HorizontalAlignment.CENTER);
        headerStyle.setBorderBottom(BorderStyle.THIN);
        headerStyle.setBorderTop(BorderStyle.THIN);
        headerStyle.setBorderLeft(BorderStyle.THIN);
        headerStyle.setBorderRight(BorderStyle.THIN);

        CellStyle titleStyle = sheet.getWorkbook().createCellStyle();
        Font titleFont = sheet.getWorkbook().createFont();
        titleFont.setBold(true);
        titleFont.setFontHeightInPoints((short) 14);
        titleStyle.setFont(titleFont);

        CellStyle dataStyle = sheet.getWorkbook().createCellStyle();
        dataStyle.setAlignment(HorizontalAlignment.CENTER);
        dataStyle.setBorderBottom(BorderStyle.THIN);
        dataStyle.setBorderTop(BorderStyle.THIN);
        dataStyle.setBorderLeft(BorderStyle.THIN);
        dataStyle.setBorderRight(BorderStyle.THIN);

        CellStyle labelStyle = sheet.getWorkbook().createCellStyle();
        Font labelFont = sheet.getWorkbook().createFont();
        labelFont.setBold(true);
        labelStyle.setFont(labelFont);
        labelStyle.setBorderBottom(BorderStyle.THIN);
        labelStyle.setBorderTop(BorderStyle.THIN);
        labelStyle.setBorderLeft(BorderStyle.THIN);
        labelStyle.setBorderRight(BorderStyle.THIN);

        // Título
        Row titleRow = sheet.createRow(rowIdx++);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue(title);
        titleCell.setCellStyle(titleStyle);
        rowIdx++; // Línea en blanco

        // Header: Nombres de puntos como columnas
        Row headerRow = sheet.createRow(rowIdx++);
        Cell cornerCell = headerRow.createCell(0);
        cornerCell.setCellValue("Desde \\ Hasta");
        cornerCell.setCellStyle(headerStyle);

        for (int i = 0; i < pointNames.size(); i++) {
            Cell cell = headerRow.createCell(i + 1);
            cell.setCellValue(pointNames.get(i));
            cell.setCellStyle(headerStyle);
        }

        // Data: Matriz
        for (int i = 0; i < pointNames.size(); i++) {
            Row row = sheet.createRow(rowIdx++);

            // Celda de etiqueta de fila (nombre del punto origen)
            Cell labelCell = row.createCell(0);
            labelCell.setCellValue(pointNames.get(i));
            labelCell.setCellStyle(labelStyle);

            // Celdas de datos
            for (int j = 0; j < pointNames.size(); j++) {
                Cell dataCell = row.createCell(j + 1);

                if (i == j) {
                    // Diagonal principal: vacía o "-"
                    dataCell.setCellValue("-");
                } else {
                    dataCell.setCellValue(matrix[i][j]);
                }

                dataCell.setCellStyle(dataStyle);
            }
        }

        // Auto-size columnas
        for (int i = 0; i <= pointNames.size(); i++) {
            sheet.autoSizeColumn(i);
        }

        // Nota al final
        rowIdx++; // Línea en blanco
        Row noteRow = sheet.createRow(rowIdx);
        Cell noteCell = noteRow.createCell(0);
        noteCell.setCellValue("Unidad: " + unit);

        CellStyle noteStyle = sheet.getWorkbook().createCellStyle();
        Font noteFont = sheet.getWorkbook().createFont();
        noteFont.setItalic(true);
        noteFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
        noteStyle.setFont(noteFont);
        noteCell.setCellStyle(noteStyle);
    }
}