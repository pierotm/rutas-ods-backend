package pe.gob.sunass.rutasods.optimization.interfaces.rest.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import pe.gob.sunass.rutasods.shared.domain.model.DayLog;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DayLogDto {

    private int day;

    @JsonProperty("start_location")
    private String startLocation;

    @JsonProperty("activity_points")
    private List<String> activityPoints;

    @JsonProperty("activity_oc_counts")
    private Map<String, Integer> activityOcCounts;

    @JsonProperty("travel_minutes")
    private int travelMinutes;

    @JsonProperty("work_minutes")
    private int workMinutes;

    @JsonProperty("overtime_minutes")
    private int overtimeMinutes;

    @JsonProperty("total_day_minutes")
    private int totalDayMinutes;

    @JsonProperty("final_location")
    private String finalLocation;

    @JsonProperty("is_return")
    private boolean isReturn;

    private String note;

    public static DayLogDto fromDomain(DayLog d) {
        DayLogDto dto = new DayLogDto();
        dto.setDay(d.getDay());
        dto.setStartLocation(d.getStartLocation());
        dto.setActivityPoints(d.getActivityPoints());
        dto.setActivityOcCounts(d.getActivityOcCounts());
        dto.setTravelMinutes(d.getTravelMinutes());
        dto.setWorkMinutes(d.getWorkMinutes());
        dto.setOvertimeMinutes(d.getOvertimeMinutes());
        dto.setTotalDayMinutes(d.getTotalDayMinutes());
        dto.setFinalLocation(d.getFinalLocation());
        dto.setReturn(d.isReturn());
        dto.setNote(d.getNote());
        return dto;
    }
}

