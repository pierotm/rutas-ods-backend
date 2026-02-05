package pe.gob.sunass.rutasods.reporting.interfaces.rest;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.sunass.rutasods.reporting.application.internal.GenerateExcelUseCase;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ReportController {

    private final GenerateExcelUseCase generateExcelUseCase;

    @GetMapping("/reports/plan-maestro/excel/{sessionId}")
    public ResponseEntity<byte[]> downloadExcel(
            @PathVariable String sessionId
    ) {

        byte[] file =
                generateExcelUseCase.generate(sessionId);

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=plan_maestro_detallado.xlsx"
                )
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(file);
    }
}