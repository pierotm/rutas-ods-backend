package pe.gob.sunass.rutasods.optimization.interfaces.rest;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import pe.gob.sunass.rutasods.optimization.application.internal.RunMasterPlanUseCase;
import pe.gob.sunass.rutasods.optimization.infrastructure.cache.OptimizationCacheService;
import pe.gob.sunass.rutasods.optimization.infrastructure.cache.OptimizationSnapshot;
import pe.gob.sunass.rutasods.optimization.interfaces.rest.dto.*;

@RestController
@RequestMapping("/api/optimize")
public class OptimizationController {

    private final RunMasterPlanUseCase runMasterPlanUseCase;
    private final OptimizationCacheService cacheService;

    public OptimizationController(RunMasterPlanUseCase runMasterPlanUseCase, OptimizationCacheService cacheService) {
        this.runMasterPlanUseCase = runMasterPlanUseCase;
        this.cacheService = cacheService;
    }

    @PostMapping
    public OptimizeResponse optimize(@Valid @RequestBody OptimizeRequest request) {
        System.out.println("REQUEST POINTS = " + request.getPoints());
        return runMasterPlanUseCase.execute(request);
    }

    @GetMapping("/{sessionId}/matrix")
    public MatrixDto getMatrix(@PathVariable String sessionId) {
        OptimizationSnapshot snapshot = cacheService.getOrThrow(sessionId);

        return new MatrixDto(
                snapshot.distanceMatrix(),
                snapshot.durationMatrix(),
                snapshot.matrixNames()
        );
    }
}
