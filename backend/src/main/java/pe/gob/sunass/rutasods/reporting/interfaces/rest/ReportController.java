package pe.gob.sunass.rutasods.reporting.interfaces.rest;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.sunass.rutasods.reporting.application.internal.GenerateExcelUseCase;
import pe.gob.sunass.rutasods.reporting.application.internal.GeneratePdfUseCase;
import pe.gob.sunass.rutasods.reporting.application.internal.GenerateMatrixExcelUseCase;

@RequestMapping("/api/reports")
public class ReportController {

    private final GenerateExcelUseCase generateExcelUseCase;
    private final GeneratePdfUseCase generatePdfUseCase;
    private final GenerateMatrixExcelUseCase generateMatrixExcelUseCase; // 1. Agregar campo

    // 2. Actualizar constructor para inyectar el nuevo UseCase
    public ReportController(
            GeneratePdfUseCase generatePdfUseCase,
            GenerateExcelUseCase generateExcelUseCase,
            GenerateMatrixExcelUseCase generateMatrixExcelUseCase) {
        this.generatePdfUseCase = generatePdfUseCase;
        this.generateExcelUseCase = generateExcelUseCase;
        this.generateMatrixExcelUseCase = generateMatrixExcelUseCase;
    }

    /**
     * Endpoint para descargar la matriz de distancias y tiempos
     * GET /api/reports/matriz/excel/{sessionId}
     */
    @GetMapping("/matriz/excel/{sessionId}")
    public ResponseEntity<byte[]> downloadMatrixExcel(@PathVariable String sessionId) {
        byte[] file = generateMatrixExcelUseCase.execute(sessionId);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=matriz_rutas.xlsx")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(file);
    }

    /**
     * Descarga Excel del plan maestro usando sessionId
     * GET /api/reports/plan-maestro/excel/{sessionId}
     */
    @GetMapping("/plan-maestro/excel/{sessionId}")
    public ResponseEntity<byte[]> downloadExcel(@PathVariable String sessionId) {
        byte[] file = generateExcelUseCase.generate(sessionId);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, 
                    "attachment; filename=plan_maestro_detallado.xlsx")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(file);
    }

    /**
     * Descarga PDF del plan maestro usando sessionId
     * GET /api/reports/plan-maestro/pdf/{sessionId}
     */
    @GetMapping("/plan-maestro/pdf/{sessionId}")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable String sessionId) {
        byte[] pdfContent = generatePdfUseCase.execute(sessionId);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "plan_maestro.pdf");
        
        return new ResponseEntity<>(pdfContent, headers, HttpStatus.OK);
    }
}