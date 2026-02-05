package pe.gob.sunass.rutasods.reporting.interfaces.rest.dto;

import lombok.Getter;
import lombok.Setter;
import pe.gob.sunass.rutasods.shared.domain.model.RouteSegment;

import java.util.List;

@Getter
@Setter
public class MasterPlanReportRequest {

    private List<RouteSegment> routes;

    private double[][] distanceMatrix;
    private List<String> matrixNames;

    private double kmCost;
    private double foodCost;
    private double hotelCost;

    private int pcDuration;
    private int ocDuration;
}
