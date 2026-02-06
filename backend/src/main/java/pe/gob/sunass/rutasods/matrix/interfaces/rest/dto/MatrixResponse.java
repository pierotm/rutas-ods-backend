package pe.gob.sunass.rutasods.matrix.interfaces.rest.dto;

import lombok.Data;

import java.util.List;

@Data
public class MatrixResponse {
    
    private double[][] distances;
    private double[][] durations;
    private List<String> labels;
}