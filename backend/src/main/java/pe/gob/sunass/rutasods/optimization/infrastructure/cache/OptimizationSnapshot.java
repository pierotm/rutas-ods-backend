package pe.gob.sunass.rutasods.optimization.infrastructure.cache;

import pe.gob.sunass.rutasods.shared.domain.model.RouteSegment;

import java.time.Instant;
import java.util.List;

public record OptimizationSnapshot(

        List<RouteSegment> routes,

        double[][] distanceMatrix,
        double[][] durationMatrix,

        List<String> matrixNames,

        double kmCost,
        double foodCost,
        double hotelCost,

        int pcDuration,
        int ocDuration,

        Instant createdAt
) {}
