package pe.gob.sunass.rutasods.costing.domain;

import pe.gob.sunass.rutasods.shared.domain.model.*;
import pe.gob.sunass.rutasods.shared.domain.rules.CostRules;

import java.util.List;

public class CostCalculator {

    public double computeTotalCost(
            double distance,
            int days,
            int nights,
            List<Location> points,
            double kmCost,
            double foodCost,
            double hotelCost
    ) {

        double gas = distance * kmCost;
        double food = foodCost * days;
        double hotel = hotelCost * nights;

        double oc = points.stream()
                .mapToDouble(p -> p.getOcCount() * CostRules.OC_UNIT_COST)
                .sum();

        return gas + food + hotel + oc;
    }

    public CostBreakdown breakdown(
            double distance,
            int days,
            int nights,
            List<Location> points,
            double kmCost,
            double foodCost,
            double hotelCost
    ) {

        CostBreakdown cb = new CostBreakdown();

        cb.setGas(distance * kmCost);
        cb.setFood(foodCost * days);
        cb.setHotel(hotelCost * nights);

        double oc = points.stream()
                .mapToDouble(p -> p.getOcCount() * CostRules.OC_UNIT_COST)
                .sum();

        cb.setOc(oc);

        return cb;
    }
}
