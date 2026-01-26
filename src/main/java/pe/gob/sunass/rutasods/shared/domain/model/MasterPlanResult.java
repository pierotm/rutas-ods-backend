package pe.gob.sunass.rutasods.shared.domain.model;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class MasterPlanResult {

    private double totalSystemCost;
    private List<RouteSegment> routes;

    private double totalDistance;
    private int totalNights;
    private int totalDays;

    private int pointsCovered;

    // getters/setters
}
