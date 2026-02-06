package pe.gob.sunass.rutasods.reporting.application.internal;

import org.springframework.stereotype.Service;
import pe.gob.sunass.rutasods.reporting.infrastructure.pdf.PdfGenerator;
import pe.gob.sunass.rutasods.shared.domain.model.MasterPlanResult;

@Service
public class GeneratePdfUseCase {

    private final PdfGenerator pdfGenerator;

    public GeneratePdfUseCase(PdfGenerator pdfGenerator) {
        this.pdfGenerator = pdfGenerator;
    }

    public byte[] execute(MasterPlanResult result) {
        // Llama a la infraestructura para generar el PDF
        return pdfGenerator.generateMasterPlanPdf(result);
    }
}