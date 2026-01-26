package pe.gob.sunass.rutasods.shared.domain.model;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class RouteSegment {

    private Long id;
    private String name;

    private List<Location> points;
    private List<DayLog> logs;

    private double totalCost;
    private CostBreakdown breakdown;

    private double distance;
    private int nights;
    private int days;

    private String color;

    // getters/setters
}