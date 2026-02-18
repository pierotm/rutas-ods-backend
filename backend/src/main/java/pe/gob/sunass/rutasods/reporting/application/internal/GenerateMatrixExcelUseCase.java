package pe.gob.sunass.rutasods.reporting.application.internal;

import org.springframework.stereotype.Service;
import pe.gob.sunass.rutasods.reporting.infrastructure.excel.MatrixExcelGenerator;
import pe.gob.sunass.rutasods.optimization.infrastructure.cache.OptimizationCacheService;
import pe.gob.sunass.rutasods.optimization.infrastructure.cache.OptimizationSnapshot;

@Service
public class GenerateMatrixExcelUseCase {

    private final MatrixExcelGenerator matrixExcelGenerator;
    private final OptimizationCacheService cacheService;

    public GenerateMatrixExcelUseCase(
            MatrixExcelGenerator matrixExcelGenerator,
            OptimizationCacheService cacheService
    ) {
        this.matrixExcelGenerator = matrixExcelGenerator;
        this.cacheService = cacheService;
    }

    /**
     * Genera el Excel de la matriz de distancias y tiempos desde la sesión cacheada
     * @param sessionId ID de la sesión de optimización
     * @return Bytes del Excel generado
     */
    public byte[] execute(String sessionId) {
        // Obtener snapshot desde el cache
        OptimizationSnapshot snapshot = cacheService.getOrThrow(sessionId);

        // Generar Excel con la matriz
        return matrixExcelGenerator.generateMatrixExcel(
                snapshot.distanceMatrix(),
                snapshot.durationMatrix(),
                snapshot.matrixNames()
        );
    }
}