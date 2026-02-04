package pe.gob.sunass.rutasods.optimization.domain.model;

import lombok.Getter;
import lombok.Setter;
import pe.gob.sunass.rutasods.shared.domain.model.CostBreakdown;
import pe.gob.sunass.rutasods.shared.domain.model.ItineraryResult;

import java.util.List;

@Getter
@Setter
public class CandidateRoute {

    private List<Integer> perm;
    private double cost;
    private double metric;
    private ItineraryResult itinerary;
    private CostBreakdown breakdown;

    // getters / setters
}
