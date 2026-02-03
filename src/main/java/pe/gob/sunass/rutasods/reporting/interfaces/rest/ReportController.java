package pe.gob.sunass.rutasods.reporting.interfaces.rest;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.sunass.rutasods.reporting.application.internal.GenerateExcelUseCase;
import pe.gob.sunass.rutasods.reporting.interfaces.rest.dto.MasterPlanReportRequest;

@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
public class ReportController {

    private final GenerateExcelUseCase generateExcelUseCase;

    @PostMapping("/plan-maestro/excel")
    public ResponseEntity<byte[]> downloadExcel(
            @RequestBody MasterPlanReportRequest request
    ) {

        byte[] file = generateExcelUseCase.generate(
                request.getRoutes(),
                request.getDistanceMatrix(),
                request.getMatrixNames(),
                request.getKmCost(),
                request.getFoodCost(),
                request.getHotelCost(),
                request.getPcDuration(),
                request.getOcDuration()
        );

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=plan_maestro_detallado.xlsx"
                )
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(file);
    }
}

