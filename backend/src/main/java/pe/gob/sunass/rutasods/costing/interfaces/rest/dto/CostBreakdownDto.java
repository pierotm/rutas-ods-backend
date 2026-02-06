package pe.gob.sunass.rutasods.costing.interfaces.rest.dto;

import lombok.Getter;
import lombok.Setter;
import pe.gob.sunass.rutasods.shared.domain.model.CostBreakdown;

@Getter
@Setter
public class CostBreakdownDto {

    private double gas;
    private double food;
    private double hotel;
    private double oc;

    public static CostBreakdownDto fromDomain(CostBreakdown c) {
        CostBreakdownDto dto = new CostBreakdownDto();

        dto.setGas(c.getGas());
        dto.setFood(c.getFood());
        dto.setHotel(c.getHotel());
        dto.setOc(c.getOc());

        return dto;
    }
}

