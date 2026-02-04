package pe.gob.sunass.rutasods.matrix.infrastructure.osrm;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OsrmTableResponse {
    private double[][] durations;   // seconds
    private double[][] distances;   // meters
    private String code;
    private String message;         // sometimes present on error
}
