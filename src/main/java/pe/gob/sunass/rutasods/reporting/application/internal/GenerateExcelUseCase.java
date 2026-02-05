package pe.gob.sunass.rutasods.reporting.application.internal;

import org.springframework.stereotype.Service;
import pe.gob.sunass.rutasods.reporting.infrastructure.excel.ExcelGenerator;
import pe.gob.sunass.rutasods.optimization.infrastructure.cache.OptimizationCacheService;
import pe.gob.sunass.rutasods.optimization.infrastructure.cache.OptimizationSnapshot;

@Service
public class GenerateExcelUseCase {

    private final ExcelGenerator excelGenerator;
    private final OptimizationCacheService cacheService;

    public GenerateExcelUseCase(
            ExcelGenerator excelGenerator,
            OptimizationCacheService cacheService
    ) {
        this.excelGenerator = excelGenerator;
        this.cacheService = cacheService;
    }

    public byte[] generate(String sessionId) {

        OptimizationSnapshot snapshot =
                cacheService.get(sessionId);

        if (snapshot == null) {
            throw new IllegalStateException(
                    "Optimization session expired or not found"
            );
        }

        return excelGenerator.generatePlanMasterExcel(
                snapshot.routes(),
                snapshot.distanceMatrix(),
                snapshot.matrixNames(),
                snapshot.kmCost(),
                snapshot.foodCost(),
                snapshot.hotelCost(),
                snapshot.pcDuration(),
                snapshot.ocDuration()
        );
    }
}
