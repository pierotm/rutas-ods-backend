package pe.gob.sunass.rutasods.reporting.infrastructure.pdf;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import org.springframework.stereotype.Component;
import pe.gob.sunass.rutasods.shared.domain.model.MasterPlanResult;
import pe.gob.sunass.rutasods.shared.domain.model.RouteSegment;
import pe.gob.sunass.rutasods.shared.domain.model.DayLog;
import pe.gob.sunass.rutasods.shared.domain.model.Location;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.text.DecimalFormat;
import java.util.stream.Stream;

@Component
public class PdfGenerator {

    // Colores Sunass
    private static final Color SUNASS_BLUE = new Color(0, 85, 150);
    private static final Color SUNASS_LIGHT = new Color(0, 159, 227);
    private static final Color SLATE_50 = new Color(248, 250, 252);
    private static final Color SLATE_100 = new Color(241, 245, 249);
    private static final Color SLATE_200 = new Color(226, 232, 240);
    private static final Color SLATE_400 = new Color(148, 163, 184);
    private static final Color SLATE_600 = new Color(71, 85, 105);
    private static final Color SLATE_700 = new Color(51, 65, 85);
    private static final Color SLATE_800 = new Color(30, 41, 59);
    private static final Color EMERALD_600 = new Color(16, 185, 129);
    private static final Color PURPLE_600 = new Color(147, 51, 234);
    
    // Fuentes
    private static final Font TITLE_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, SUNASS_BLUE);
    private static final Font SUBTITLE_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, SUNASS_BLUE);
    private static final Font HEADER_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
    private static final Font BOLD_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, SLATE_800);
    private static final Font NORMAL_FONT = FontFactory.getFont(FontFactory.HELVETICA, 8, SLATE_600);
    private static final Font SMALL_FONT = FontFactory.getFont(FontFactory.HELVETICA, 7, SLATE_400);
    private static final Font METRIC_FONT = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, Color.WHITE);
    
    private static final DecimalFormat MONEY_FORMAT = new DecimalFormat("S/ #,##0.00");
    private static final DecimalFormat NUMBER_FORMAT = new DecimalFormat("#,##0.00");

    public byte[] generateMasterPlanPdf(MasterPlanResult result) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 30, 30, 30, 30);
            PdfWriter writer = PdfWriter.getInstance(document, out);
            
            // Header/Footer personalizado
            writer.setPageEvent(new PdfPageEventHelper() {
                @Override
                public void onEndPage(PdfWriter writer, Document document) {
                    PdfContentByte cb = writer.getDirectContent();
                    
                    // Footer
                    Phrase footer = new Phrase("Sistema de Gestión ODS • Sunass 2026", 
                        FontFactory.getFont(FontFactory.HELVETICA, 7, SLATE_400));
                    ColumnText.showTextAligned(cb, Element.ALIGN_CENTER, footer,
                        (document.right() - document.left()) / 2 + document.leftMargin(),
                        document.bottom() - 10, 0);
                }
            });
            
            document.open();

            // ==================== ENCABEZADO PRINCIPAL ====================
            addHeader(document);
            document.add(new Chunk("\n"));

            // ==================== MÉTRICAS PRINCIPALES ====================
            addMetricsSection(document, result);
            document.add(new Chunk("\n"));

            // ==================== DETALLES POR RUTA ====================
            addRoutesSection(document, result);

            document.close();
            return out.toByteArray();
            
        } catch (Exception e) {
            throw new RuntimeException("Error al generar el reporte PDF", e);
        }
    }

    private void addHeader(Document document) throws DocumentException {
        Paragraph title = new Paragraph("INFORME DE PLAN MAESTRO", TITLE_FONT);
        title.setAlignment(Element.ALIGN_CENTER);
        title.setSpacingAfter(5);
        document.add(title);

        Paragraph subtitle = new Paragraph("Optimización Logística de Rutas de Supervisión", 
            FontFactory.getFont(FontFactory.HELVETICA, 10, SLATE_600));
        subtitle.setAlignment(Element.ALIGN_CENTER);
        subtitle.setSpacingAfter(10);
        document.add(subtitle);

        // Línea separadora
        PdfPTable line = new PdfPTable(1);
        line.setWidthPercentage(100);
        PdfPCell lineCell = new PdfPCell();
        lineCell.setBorder(Rectangle.BOTTOM);
        lineCell.setBorderColorBottom(SLATE_200);
        lineCell.setBorderWidthBottom(1);
        lineCell.setFixedHeight(1);
        line.addCell(lineCell);
        document.add(line);
    }

    private void addMetricsSection(Document document, MasterPlanResult result) throws DocumentException {
        // Calcular métricas adicionales
        int pcCount = result.getRoutes().stream()
            .mapToInt(r -> (int) r.getPoints().stream()
                .filter(p -> p.getCategory() == Location.Category.PC).count())
            .sum();
            
        int ocCount = result.getRoutes().stream()
            .mapToInt(r -> (int) r.getPoints().stream()
                .filter(p -> p.getCategory() == Location.Category.OC).count())
            .sum();

        // Tabla de métricas (3 columnas x 2 filas)
        PdfPTable metricsTable = new PdfPTable(3);
        metricsTable.setWidthPercentage(100);
        metricsTable.setSpacingAfter(15);
        
        // Fila 1
        addMetricCard(metricsTable, "Costo Total Sistema", 
            MONEY_FORMAT.format(result.getTotalSystemCost()), 
            result.getPointsCovered() + " puntos", SUNASS_BLUE);
        addMetricCard(metricsTable, "Rutas Generadas", 
            String.valueOf(result.getRoutes().size()), 
            "Flota requerida", SLATE_700);
        addMetricCard(metricsTable, "Puntos PC", 
            String.valueOf(pcCount), 
            "Cubiertos", SUNASS_BLUE);
        
        // Fila 2
        addMetricCard(metricsTable, "Puntos OC", 
            String.valueOf(ocCount), 
            "Cubiertos", PURPLE_600);
        addMetricCard(metricsTable, "Distancia Total", 
            NUMBER_FORMAT.format(result.getTotalDistance()) + " km", 
            "", SLATE_700);
        addMetricCard(metricsTable, "Total Noches", 
            String.valueOf(result.getTotalNights()), 
            "", SLATE_700);
        
        document.add(metricsTable);
    }

    private void addMetricCard(PdfPTable table, String label, String value, String subtitle, Color color) {
        PdfPCell card = new PdfPCell();
        card.setPadding(8);
        card.setBorderColor(SLATE_200);
        card.setBorderWidth(1);
        
        // Crear contenido interno
        Paragraph labelP = new Paragraph(label, 
            FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7, SLATE_400));
        labelP.setSpacingAfter(3);
        
        Paragraph valueP = new Paragraph(value, 
            FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, color));
        valueP.setSpacingAfter(2);
        
        if (!subtitle.isEmpty()) {
            Paragraph subtitleP = new Paragraph(subtitle, 
                FontFactory.getFont(FontFactory.HELVETICA, 6, SLATE_400));
            card.addElement(labelP);
            card.addElement(valueP);
            card.addElement(subtitleP);
        } else {
            card.addElement(labelP);
            card.addElement(valueP);
        }
        
        table.addCell(card);
    }

    private void addRoutesSection(Document document, MasterPlanResult result) throws DocumentException {
        int routeIndex = 1;
        
        for (RouteSegment route : result.getRoutes()) {
            // ==================== HEADER DE RUTA ====================
            Paragraph routeTitle = new Paragraph("RUTA " + routeIndex + ": " + route.getName(), SUBTITLE_FONT);
            routeTitle.setSpacingBefore(10);
            routeTitle.setSpacingAfter(5);
            document.add(routeTitle);

            // Info resumen de la ruta
            Paragraph routeInfo = new Paragraph(
                String.format("Duración: %d días / %d noches | Distancia: %.0f km | Costo: %s", 
                    route.getDays(), 
                    route.getNights(), 
                    route.getDistance(),
                    MONEY_FORMAT.format(route.getTotalCost())),
                BOLD_FONT
            );
            routeInfo.setSpacingAfter(8);
            document.add(routeInfo);

            // ==================== TABLA DE ITINERARIO ====================
            PdfPTable itineraryTable = new PdfPTable(new float[]{1, 2, 1.5f, 4, 3});
            itineraryTable.setWidthPercentage(100);
            itineraryTable.setSpacingAfter(10);
            
            // Encabezados
            Stream.of("Día", "Inicio", "Ubigeo", "Actividades", "Notas")
                .forEach(header -> {
                    PdfPCell cell = new PdfPCell(new Phrase(header, HEADER_FONT));
                    cell.setBackgroundColor(SUNASS_BLUE);
                    cell.setPadding(6);
                    cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                    itineraryTable.addCell(cell);
                });

            // Contenido
            for (DayLog log : route.getLogs()) {
                // Día
                PdfPCell dayCell = new PdfPCell(new Phrase("Día " + log.getDay(), BOLD_FONT));
                dayCell.setPadding(5);
                dayCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                dayCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
                itineraryTable.addCell(dayCell);

                // Inicio
                PdfPCell startCell = new PdfPCell(new Phrase(log.getStartLocation(), NORMAL_FONT));
                startCell.setPadding(5);
                itineraryTable.addCell(startCell);

                // UBIGEO
                String ubigeoStr = "-";
                if (!log.getActivityPoints().isEmpty()) {
                    String firstPointName = log.getActivityPoints().get(0);
                    Location firstPoint = route.getPoints().stream()
                        .filter(p -> p.getName().equals(firstPointName))
                        .findFirst()
                        .orElse(null);
                    if (firstPoint != null && firstPoint.getUbigeo() != null && !firstPoint.getUbigeo().isEmpty()) {
                            ubigeoStr = firstPoint.getUbigeo();
                    }
                }

                PdfPCell ubigeoCell = new PdfPCell(new Phrase(ubigeoStr, SMALL_FONT));
                ubigeoCell.setPadding(5);
                ubigeoCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                itineraryTable.addCell(ubigeoCell);

                // Actividades
                StringBuilder activities = new StringBuilder();
                activities.append(log.getStartLocation()).append(" → ");
                
                for (int i = 0; i < log.getActivityPoints().size(); i++) {
                    String point = log.getActivityPoints().get(i);
                    activities.append(point);
                    
                    // Agregar badge de OC si hay
                    Integer ocCount = log.getActivityOcCounts().get(point);
                    if (ocCount != null && ocCount > 0) {
                        activities.append(" (+").append(ocCount).append(" OC)");
                    }
                    
                    if (i < log.getActivityPoints().size() - 1) {
                        activities.append(" → ");
                    }
                }
                
                if (log.isReturn()) {
                    activities.append(" → ODS ✓");
                }
                
                PdfPCell activitiesCell = new PdfPCell(new Phrase(activities.toString(), NORMAL_FONT));
                activitiesCell.setPadding(5);
                itineraryTable.addCell(activitiesCell);

                // Notas
                String noteText = log.isReturn() 
                    ? "Retorno exitoso" 
                    : (log.getNote() != null ? log.getNote() : "-");
                    
                if (log.getOvertimeMinutes() > 0) {
                    noteText += String.format(" (Sobretiempo: %d min)", log.getOvertimeMinutes());
                }
                
                PdfPCell noteCell = new PdfPCell(new Phrase(noteText, SMALL_FONT));
                noteCell.setPadding(5);
                itineraryTable.addCell(noteCell);
            }
            
            document.add(itineraryTable);

            // ==================== DESGLOSE DE COSTOS ====================
            Paragraph costBreakdown = new Paragraph("Desglose de Costos:", BOLD_FONT);
            costBreakdown.setSpacingBefore(5);
            costBreakdown.setSpacingAfter(3);
            document.add(costBreakdown);

            Paragraph costs = new Paragraph(
                String.format("Combustible: %s | Alimentación: %s | Alojamiento: %s | OC: %s",
                    MONEY_FORMAT.format(route.getBreakdown().getGas()),
                    MONEY_FORMAT.format(route.getBreakdown().getFood()),
                    MONEY_FORMAT.format(route.getBreakdown().getHotel()),
                    MONEY_FORMAT.format(route.getBreakdown().getOc())
                ),
                NORMAL_FONT
            );
            costs.setSpacingAfter(15);
            document.add(costs);

            // Línea separadora entre rutas
            if (routeIndex < result.getRoutes().size()) {
                PdfPTable separator = new PdfPTable(1);
                separator.setWidthPercentage(100);
                separator.setSpacingAfter(10);
                PdfPCell sepCell = new PdfPCell();
                sepCell.setBorder(Rectangle.TOP);
                sepCell.setBorderColorTop(SLATE_200);
                sepCell.setFixedHeight(1);
                separator.addCell(sepCell);
                document.add(separator);
            }

            routeIndex++;
        }
    }
}