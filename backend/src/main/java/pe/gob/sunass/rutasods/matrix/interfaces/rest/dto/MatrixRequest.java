package pe.gob.sunass.rutasods.matrix.interfaces.rest.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
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
        private Double lat;
        
        @NotNull
        private Double lng;
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
        
        // ✅ CORRECCIÓN: El frontend envía "active", no "isActive"
        @JsonProperty("active")
        private Boolean active;
        
        // Getter compatible con el código del controlador
        public boolean isActive() {
            return active != null && active;
        }
    }
    
}