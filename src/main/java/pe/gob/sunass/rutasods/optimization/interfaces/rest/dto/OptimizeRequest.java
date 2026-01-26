package pe.gob.sunass.rutasods.optimization.interfaces.rest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OptimizeRequest {

    @NotNull
    private OdsDto ods;

    @NotNull
    private List<LocationDto> points;

    private Integer coverageLimit;

    private Integer pcDuration;
    private Integer ocDuration;

    private CostsDto costs;

    private Double timeFactor;

    private ConstraintsDto constraints;

    // getters/setters

    public static class OdsDto {
        public double lat;
        public double lng;
    }

    public static class CostsDto {
        public double km;
        public double food;
        public double hotel;
    }

    public static class ConstraintsDto {
        public Integer maxRouteDays;
        public Integer searchPoolSize;
        public Integer maxComboSize;
    }
}
