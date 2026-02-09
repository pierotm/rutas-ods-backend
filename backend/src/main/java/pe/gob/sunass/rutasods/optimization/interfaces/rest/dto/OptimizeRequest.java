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

    // ✅ Clases internas con campos PÚBLICOS para compatibilidad con código existente
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OdsDto {
        public double lat;
        public double lng;
    }

    @NoArgsConstructor
    @AllArgsConstructor
    public static class CostsDto {
        public double km;
        public double food;
        public double hotel;
    }

    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConstraintsDto {
        public Integer maxRouteDays;
        public Integer searchPoolSize;
        public Integer maxComboSize;
    }
}