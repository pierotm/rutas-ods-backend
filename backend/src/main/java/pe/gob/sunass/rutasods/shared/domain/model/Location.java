package pe.gob.sunass.rutasods.shared.domain.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class Location {
    private Long id;
    private String name;
    private String coords;
    private double lat;
    private double lng;
    private int ocCount;
    private Category category;
    private String ubigeo;
    private String relatedUbigeo;
    private boolean active;

    public enum Category {
        PC, OC
    }

    // getters/setters
}
