package pe.gob.sunass.rutasods.reporting.interfaces.rest;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.sunass.rutasods.reporting.application.internal.GenerateExcelUseCase;
import pe.gob.sunass.rutasods.reporting.application.internal.GeneratePdfUseCase;
import pe.gob.sunass.rutasods.shared.domain.model.MasterPlanResult;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final GenerateExcelUseCase generateExcelUseCase;
    private final GeneratePdfUseCase generatePdfUseCase;

    public ReportController(GeneratePdfUseCase generatePdfUseCase, GenerateExcelUseCase generateExcelUseCase) {
        this.generatePdfUseCase = generatePdfUseCase;
        this.generateExcelUseCase = generateExcelUseCase;
    }

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

    @PostMapping("/master-plan-pdf")
    public ResponseEntity<byte[]> downloadPdf(@RequestBody MasterPlanResult result) {
        byte[] pdfContent = generatePdfUseCase.execute(result);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "plan-maestro.pdf");
        
        return new ResponseEntity<>(pdfContent, headers, HttpStatus.OK);
    }
}
