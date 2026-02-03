package pe.gob.sunass.rutasods.reporting.application.internal;

import org.springframework.stereotype.Service;
import pe.gob.sunass.rutasods.shared.domain.model.RouteSegment;
import pe.gob.sunass.rutasods.reporting.infrastructure.excel.ExcelGenerator;

import java.util.List;

@Service
public class GenerateExcelUseCase {

    private final ExcelGenerator excelGenerator;

    public GenerateExcelUseCase(ExcelGenerator excelGenerator) {
        this.excelGenerator = excelGenerator;
    }

    public byte[] generate(
            List<RouteSegment> routes,
            double[][] distanceMatrix,
            List<String> matrixNames,
            double kmCost,
            double foodCost,
            double hotelCost,
            int pcDuration,
            int ocDuration
    ) {
        return excelGenerator.generatePlanMasterExcel(
                routes,
                distanceMatrix,
                matrixNames,
                kmCost,
                foodCost,
                hotelCost,
                pcDuration,
                ocDuration
        );
    }
}
