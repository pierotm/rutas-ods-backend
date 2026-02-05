package pe.gob.sunass.rutasods.shared.domain.model;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class DayLog {
    private int day;
    private String startLocation;
    private List<String> activityPoints; // Nombres de los puntos visitados
    private Map<String, Integer> activityOcCounts; // Para el detalle de OCs por punto
    private int travelMinutes;
    private int workMinutes;
    private int overtimeMinutes;
    private int totalDayMinutes;
    private String finalLocation;
    private boolean isReturn;
    private String note;
}