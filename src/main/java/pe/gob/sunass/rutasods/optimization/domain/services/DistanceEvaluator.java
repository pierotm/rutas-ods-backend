package pe.gob.sunass.rutasods.optimization.domain.services;

import pe.gob.sunass.rutasods.shared.domain.model.Location;

public class DistanceEvaluator {

    private final double[][] distances;

    public DistanceEvaluator(double[][] distances) {
        this.distances = distances;
    }

    public double getDist(
            int i,
            int j,
            Location p1,
            Location p2,
            ConnectionValidator validator
    ) {
        if (!validator.isValid(p1, p2)) {
            return Double.POSITIVE_INFINITY;
        }
        return distances[i][j];
    }

    @FunctionalInterface
    public interface ConnectionValidator {
        boolean isValid(Location a, Location b);
    }
}
