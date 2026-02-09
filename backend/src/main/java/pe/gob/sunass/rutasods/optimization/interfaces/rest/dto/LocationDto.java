package pe.gob.sunass.rutasods.optimization.interfaces.rest.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import pe.gob.sunass.rutasods.shared.domain.model.Location;

@Data
public class LocationDto {

    private Long id;
    private String name;
    private Double lat;
    private Double lng;
    private Integer ocCount;
    private String category;
    private String ubigeo;
    
    // ✅ El frontend envía "active", no "isActive"
    @JsonProperty("active")
    private Boolean active;

    // ✅ Método para compatibilidad con filtros existentes
    public boolean isActive() {
        return active != null && active;
    }

    public Location toDomain() {

        Location l = new Location();

        l.setId(id);
        l.setName(name);
        l.setLat(lat);
        l.setLng(lng);
        l.setCoords(lat + "," + lng);
        l.setOcCount(ocCount != null ? ocCount : 0);
        l.setUbigeo(ubigeo);
        l.setActive(active != null && active);

        if (category != null) {
            l.setCategory(Location.Category.valueOf(category));
        } else {
            l.setCategory(Location.Category.PC);
        }

        return l;
    }
}