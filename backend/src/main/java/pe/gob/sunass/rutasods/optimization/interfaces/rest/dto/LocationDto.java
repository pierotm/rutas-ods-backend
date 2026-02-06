package pe.gob.sunass.rutasods.optimization.interfaces.rest.dto;

import lombok.Data;
import pe.gob.sunass.rutasods.shared.domain.model.Location;

@Data
public class LocationDto {

    private Long id;
    private String name;
    private double lat;
    private double lng;
    private int ocCount;
    private String category;
    private String ubigeo;
    private boolean active;

    public Location toDomain() {

        Location l = new Location();

        l.setId(id);
        l.setName(name);
        l.setLat(lat);
        l.setLng(lng);
        l.setCoords(lat + "," + lng);
        l.setOcCount(ocCount);
        l.setUbigeo(ubigeo);
        l.setActive(active);

        l.setCategory(
                Location.Category.valueOf(category));

        return l;
    }
}
