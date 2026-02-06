package pe.gob.sunass.rutasods.optimization.interfaces.rest.dto;

import java.util.List;


public class MatrixDto {

    private double[][] distances;
    private double[][] durations;
    private List<String> labels;

    public MatrixDto() {}

    public MatrixDto(
            double[][] distances,
            double[][] durations,
            List<String> labels
    ) {
        this.distances = distances;
        this.durations = durations;
        this.labels = labels;
    }

    public double[][] getDistances() {
        return distances;
    }

    public void setDistances(double[][] distances) {
        this.distances = distances;
    }

    public double[][] getDurations() {
        return durations;
    }

    public void setDurations(double[][] durations) {
        this.durations = durations;
    }

    public List<String> getLabels() {
        return labels;
    }

    public void setLabels(List<String> labels) {
        this.labels = labels;
    }
}

