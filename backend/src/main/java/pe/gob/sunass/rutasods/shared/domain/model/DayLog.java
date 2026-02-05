package pe.gob.sunass.rutasods.shared.domain.model;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class DayLog {

    private int day;
    private String startLocation;
    private List<String> activityPoints;
    private Map<String, Integer> activityOcCounts;

    private int travelMinutes;
    private int workMinutes;
    private int overtimeMinutes;
    private int totalDayMinutes;

    private String finalLocation;
    private boolean isReturn;
    private String note;

    // getters/setters

}