package pe.gob.sunass.rutasods.matrix.infrastructure.osrm;

import org.springframework.stereotype.Service;
import pe.gob.sunass.rutasods.matrix.application.internal.MatrixService;
import pe.gob.sunass.rutasods.shared.domain.model.Location;

import java.util.ArrayList;
import java.util.List;

@Service
public class OsrmMatrixService implements MatrixService {

    private final OsrmClient osrmClient;
    private final OsrmProperties props;

    public OsrmMatrixService(OsrmClient osrmClient, OsrmProperties props) {
        this.osrmClient = osrmClient;
        this.props = props;
    }

    @Override
    public MatrixResult calculateMatrix(
            List<Location> origins,
            List<Location> destinations,
            double timeFactor
    ) {
        // Para tu caso actual: origins == destinations (square matrix).
        // Igual lo dejamos general.

        int n = origins.size();
        int m = destinations.size();

        double[][] distancesKm = new double[n][m];
        double[][] durationsMin = new double[n][m];

        // Estrategia: chunkeamos destinos en grupos de chunkSize
        int chunkSize = props.getChunkSize();

        for (int destStart = 0; destStart < m; destStart += chunkSize) {
            int destEnd = Math.min(destStart + chunkSize, m);
            List<Location> destChunk = destinations.subList(destStart, destEnd);

            // Construimos lista combinada: [origins..., destChunk...]
            List<Location> combined = new ArrayList<>(n + destChunk.size());
            combined.addAll(origins);
            combined.addAll(destChunk);

            String coords = toOsrmCoordinates(combined);

            OsrmTableResponse res = osrmClient.table(
                    coords,
                    n,
                    destChunk.size()
            );

            if (res == null || res.getDurations() == null || res.getDistances() == null) {
                throw new IllegalStateException("OSRM response inválida (durations/distances null)");
            }
            if (res.getCode() != null && !"Ok".equalsIgnoreCase(res.getCode())) {
                throw new IllegalStateException("OSRM error: " + res.getCode() +
                        (res.getMessage() != null ? " - " + res.getMessage() : ""));
            }

            // res matrices vienen en: durations[sources][destinations], distances[sources][destinations]
            double[][] durSec = res.getDurations();
            double[][] distM = res.getDistances();

            for (int i = 0; i < n; i++) {
                for (int j = 0; j < destChunk.size(); j++) {
                    // distancia en km
                    double km = distM[i][j] / 1000.0;
                    distancesKm[i][destStart + j] = round2(km);

                    // duración en minutos con timeFactor aplicado en backend
                    double minutes = (durSec[i][j] / 60.0) * timeFactor;
                    durationsMin[i][destStart + j] = round2(minutes);
                }
            }
        }

        return new MatrixResult(distancesKm, durationsMin);
    }

    private String toOsrmCoordinates(List<Location> points) {
        // OSRM exige "lon,lat;lon,lat..."
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < points.size(); i++) {
            Location p = points.get(i);
            if (i > 0) sb.append(';');
            sb.append(p.getLng()).append(',').append(p.getLat());
        }
        return sb.toString();
    }

    private double round2(double v) {
    return Math.round(v * 100.0) / 100.0;
}
}
