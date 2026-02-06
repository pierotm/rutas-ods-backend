package pe.gob.sunass.rutasods.reporting.infrastructure.pdf;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Component;
import pe.gob.sunass.rutasods.shared.domain.model.MasterPlanResult;
import pe.gob.sunass.rutasods.shared.domain.model.RouteSegment;
import pe.gob.sunass.rutasods.shared.domain.model.DayLog;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.text.DecimalFormat;

@Component
public class PdfGenerator {

    private static final Font TITLE_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.BLACK);
    private static final Font SUBTITLE_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(0, 85, 150)); // Sunass Blue
    private static final Font BOLD_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);
    private static final Font NORMAL_FONT = FontFactory.getFont(FontFactory.HELVETICA, 10);
    private static final DecimalFormat MONEY_FORMAT = new DecimalFormat("S/ #,##0.00");

    public byte[] generateMasterPlanPdf(MasterPlanResult result) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4);
            PdfWriter.getInstance(document, out);
            document.open();

            // 1. Encabezado del Informe
            document.add(new Paragraph("INFORME DE PLAN MAESTRO (100% COBERTURA)", TITLE_FONT));
            document.add(new Paragraph("Resumen Ejecutivo de Rutas de Supervisión", NORMAL_FONT));
            document.add(new Chunk("\n"));

            // 2. Tabla de Resumen General (Métricas de index.tsx)
            PdfPTable summaryTable = new PdfPTable(4);
            summaryTable.setWidthPercentage(100);
            addSummaryCell(summaryTable, "Costo Total", MONEY_FORMAT.format(result.getTotalSystemCost()));
            addSummaryCell(summaryTable, "Distancia Total", result.getTotalDistance() + " km");
            addSummaryCell(summaryTable, "Total Días", String.valueOf(result.getTotalDays()));
            addSummaryCell(summaryTable, "Puntos Cubiertos", String.valueOf(result.getPointsCovered()));
            document.add(summaryTable);
            document.add(new Chunk("\n"));

            // 3. Detalles por Ruta
            int routeIndex = 1;
            for (RouteSegment route : result.getRoutes()) {
                document.add(new Paragraph("RUTA " + routeIndex + ": " + route.getName(), SUBTITLE_FONT));
                
                // Info de la ruta (Días, Pernoctes, Costo)
                Paragraph routeInfo = new Paragraph(
                    String.format("Duración: %d días / %d noches | Costo de Ruta: %s", 
                    route.getDays(), route.getNights(), MONEY_FORMAT.format(route.getTotalCost())),
                    BOLD_FONT
                );
                document.add(routeInfo);
                document.add(new Chunk("\n"));

                // Tabla de Itinerario (Basada en logs de index.tsx)
                PdfPTable itineraryTable = new PdfPTable(new float[]{1, 3, 3, 2, 2});
                itineraryTable.setWidthPercentage(100);
                
                // Encabezados de tabla
                String[] headers = {"Día", "Inicio", "Actividades", "Fin", "Nota"};
                for (String h : headers) {
                    PdfPCell cell = new PdfPCell(new Phrase(h, BOLD_FONT));
                    cell.setBackgroundColor(new Color(241, 245, 249)); // slate-100
                    cell.setPadding(5);
                    itineraryTable.addCell(cell);
                }

                for (DayLog log : route.getLogs()) {
                    itineraryTable.addCell(new Phrase(String.valueOf(log.getDay()), NORMAL_FONT));
                    itineraryTable.addCell(new Phrase(log.getStartLocation(), NORMAL_FONT));
                    itineraryTable.addCell(new Phrase(String.join(", ", log.getActivityPoints()), NORMAL_FONT));
                    itineraryTable.addCell(new Phrase(log.getFinalLocation(), NORMAL_FONT));
                    itineraryTable.addCell(new Phrase(log.isReturn() ? "Retorno" : (log.getNote() != null ? log.getNote() : "-"), NORMAL_FONT));
                }
                
                document.add(itineraryTable);
                document.add(new Chunk("\n"));
                
                // Desglose de costos de la ruta (breakdown)
                document.add(new Paragraph("Desglose de Gastos:", BOLD_FONT));
                document.add(new Paragraph(String.format(
                    "Combustible: %s | Alimentación: %s | Alojamiento: %s | Otros (OC): %s",
                    MONEY_FORMAT.format(route.getBreakdown().getGas()),
                    MONEY_FORMAT.format(route.getBreakdown().getFood()),
                    MONEY_FORMAT.format(route.getBreakdown().getHotel()),
                    MONEY_FORMAT.format(route.getBreakdown().getOc())
                ), NORMAL_FONT));
                
                document.add(new Paragraph("----------------------------------------------------------------------------------------------------------------------------------"));
                routeIndex++;
            }

            document.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Error al generar el reporte PDF", e);
        }
    }

    private void addSummaryCell(PdfPTable table, String label, String value) {
        PdfPCell cell = new PdfPCell();
        cell.setPadding(8);
        cell.setBorderColor(new Color(226, 232, 240)); // slate-200
        cell.addElement(new Phrase(label, FontFactory.getFont(FontFactory.HELVETICA, 8, Color.GRAY)));
        cell.addElement(new Phrase(value, BOLD_FONT));
        table.addCell(cell);
    }
}