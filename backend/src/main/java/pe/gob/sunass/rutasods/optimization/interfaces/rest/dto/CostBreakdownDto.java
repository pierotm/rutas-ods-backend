package pe.gob.sunass.rutasods.optimization.interfaces.rest.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CostBreakdownDto {
    private double gas;
    private double hotel;
    private double perDiem; // Viáticos
    private double total;
}