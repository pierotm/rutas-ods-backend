package pe.gob.sunass.rutasods.reporting.application.internal;

import org.springframework.stereotype.Service;
import pe.gob.sunass.rutasods.reporting.infrastructure.pdf.PdfGenerator;
import pe.gob.sunass.rutasods.optimization.infrastructure.cache.OptimizationCacheService;
import pe.gob.sunass.rutasods.optimization.infrastructure.cache.OptimizationSnapshot;
import pe.gob.sunass.rutasods.shared.domain.model.MasterPlanResult;

@Service
public class GeneratePdfUseCase {

    private final PdfGenerator pdfGenerator;
    private final OptimizationCacheService cacheService;

    public GeneratePdfUseCase(PdfGenerator pdfGenerator, OptimizationCacheService cacheService) {
        this.pdfGenerator = pdfGenerator;
        this.cacheService = cacheService;
    }

    /**
     * Genera el PDF del plan maestro desde la sesión cacheada
     * @param sessionId ID de la sesión de optimización
     * @return Bytes del PDF generado
     */
    public byte[] execute(String sessionId) {
        // Obtener snapshot desde el cache
        OptimizationSnapshot snapshot = cacheService.getOrThrow(sessionId);

        // Construir MasterPlanResult desde el snapshot
        MasterPlanResult result = buildMasterPlanResult(snapshot);

        // 🔥 GENERAR PDF CON CONFIGURACIÓN (incluyendo timeFactor)
        return pdfGenerator.generateMasterPlanPdf(
                result,
                snapshot.kmCost(),
                snapshot.foodCost(),
                snapshot.hotelCost(),
                snapshot.pcDuration(),
                snapshot.ocDuration(),
                snapshot.timeFactor()
        );
    }

    /**
     * Construye MasterPlanResult desde OptimizationSnapshot
     */
    private MasterPlanResult buildMasterPlanResult(OptimizationSnapshot snapshot) {
        MasterPlanResult result = new MasterPlanResult();

        // Calcular totales
        double totalSystemCost = snapshot.routes().stream()
                .mapToDouble(r -> r.getTotalCost())
                .sum();

        double totalDistance = snapshot.routes().stream()
                .mapToDouble(r -> r.getDistance())
                .sum();

        int totalNights = snapshot.routes().stream()
                .mapToInt(r -> r.getNights())
                .sum();

        int totalDays = snapshot.routes().stream()
                .mapToInt(r -> r.getDays())
                .sum();

        int pointsCovered = snapshot.routes().stream()
                .mapToInt(r -> r.getPoints().size())
                .sum();

        // Configurar resultado
        result.setTotalSystemCost(totalSystemCost);
        result.setRoutes(snapshot.routes());
        result.setTotalDistance(totalDistance);
        result.setTotalNights(totalNights);
        result.setTotalDays(totalDays);
        result.setPointsCovered(pointsCovered);

        return result;
    }
}