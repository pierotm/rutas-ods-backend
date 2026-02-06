package pe.gob.sunass.rutasods.matrix.interfaces.rest.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class MatrixRequest {

    @NotNull
    private OdsDto ods;

    @NotNull
    private List<PointDto> points;

    private Double timeFactor;

    @Data
    public static class OdsDto {
        @NotNull
        public Double lat;
        
        @NotNull
        public Double lng;
    }

    @Data
    public static class PointDto {
        private Long id;
        private String name;
        
        @NotNull
        private Double lat;
        
        @NotNull
        private Double lng;
        
        private Integer ocCount;
        private String category;
        private String ubigeo;
        
        private boolean isActive; 
    }
}