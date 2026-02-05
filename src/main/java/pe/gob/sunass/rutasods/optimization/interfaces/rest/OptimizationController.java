package pe.gob.sunass.rutasods.optimization.interfaces.rest;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import pe.gob.sunass.rutasods.optimization.application.internal.RunMasterPlanUseCase;
import pe.gob.sunass.rutasods.optimization.interfaces.rest.dto.*;

@RestController
@RequestMapping("/api/optimize")
public class OptimizationController {

    private final RunMasterPlanUseCase runMasterPlanUseCase;

    public OptimizationController(RunMasterPlanUseCase runMasterPlanUseCase) {
        this.runMasterPlanUseCase = runMasterPlanUseCase;
    }

    @PostMapping
    public OptimizeResponse optimize(@Valid @RequestBody OptimizeRequest request) {
        System.out.println("REQUEST POINTS = " + request.getPoints());
        return runMasterPlanUseCase.execute(request);
    }
}
