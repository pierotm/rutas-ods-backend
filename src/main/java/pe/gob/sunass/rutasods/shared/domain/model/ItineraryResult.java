package pe.gob.sunass.rutasods.shared.domain.model;

import java.util.List;

public class ItineraryResult {

    private int numDays;
    private int numNights;
    private List<DayLog> logs;

    public ItineraryResult(int numDays, int numNights, List<DayLog> logs) {
        this.numDays = numDays;
        this.numNights = numNights;
        this.logs = logs;
    }

    public int getNumDays() {
        return numDays;
    }

    public int getNumNights() {
        return numNights;
    }

    public List<DayLog> getLogs() {
        return logs;
    }
}

