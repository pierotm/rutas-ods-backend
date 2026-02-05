package pe.gob.sunass.rutasods.optimization.interfaces.rest.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;
import pe.gob.sunass.rutasods.shared.domain.model.DayLog; // Tu clase de dominio

import java.util.List;
import java.util.Map;

@Getter
@Setter
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
    
    @JsonProperty("total_day_minutes")
    private int totalDayMinutes;
    
    @JsonProperty("final_location")
    private String finalLocation;
    
    @JsonProperty("is_return")
    private boolean isReturn;
    
    private String note;

    public static DayLogDto fromDomain(DayLog log) {
        DayLogDto dto = new DayLogDto();
        dto.setDay(log.getDay());
        dto.setStartLocation(log.getStartLocation());
        dto.setActivityPoints(log.getActivityPoints());
        dto.setActivityOcCounts(log.getActivityOcCounts());
        dto.setTravelMinutes(log.getTravelMinutes());
        dto.setWorkMinutes(log.getWorkMinutes());
        dto.setTotalDayMinutes(log.getTotalDayMinutes());
        dto.setFinalLocation(log.getFinalLocation());
        dto.setReturn(log.isReturn());
        dto.setNote(log.getNote());
        return dto;
    }
}