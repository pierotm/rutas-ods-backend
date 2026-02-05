package pe.gob.sunass.rutasods.matrix.application.internal;

import pe.gob.sunass.rutasods.shared.domain.model.Location;

import java.util.List;

public interface MatrixService {

    MatrixResult calculateMatrix(
            List<Location> origins,
            List<Location> destinations,
            double timeFactor
    );

    record MatrixResult(
            double[][] distances,
            double[][] durations
    ) {}
}
