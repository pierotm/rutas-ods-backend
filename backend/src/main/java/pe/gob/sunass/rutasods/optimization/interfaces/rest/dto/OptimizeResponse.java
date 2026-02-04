package pe.gob.sunass.rutasods.optimization.interfaces.rest.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class OptimizeResponse {

    private double totalSystemCost;
    private List<RouteSegmentDto> routes;

    private double totalDistance;
    private int totalNights;
    private int totalDays;

    private int pointsCovered;

    // getters/setters
}
