package pe.gob.sunass.rutasods.matrix.interfaces.rest;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import pe.gob.sunass.rutasods.matrix.application.internal.MatrixService;
import pe.gob.sunass.rutasods.matrix.interfaces.rest.dto.MatrixRequest;
import pe.gob.sunass.rutasods.matrix.interfaces.rest.dto.MatrixResponse;
import pe.gob.sunass.rutasods.shared.domain.model.Location;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/matrix")
public class MatrixController {

    private final MatrixService matrixService;

    public MatrixController(MatrixService matrixService) {
        this.matrixService = matrixService;
    }

    @PostMapping("/calculate")
    public MatrixResponse calculateMatrix(@Valid @RequestBody MatrixRequest request) {
        
        // 1) Construir ODS como Location
        Location ods = new Location();
        ods.setId(-1L);
        ods.setName("ODS (Base)");
        ods.setLat(request.getOds().lat);
        ods.setLng(request.getOds().lng);
        ods.setCoords(request.getOds().lat + "," + request.getOds().lng);
        ods.setCategory(Location.Category.PC);
        ods.setActive(true);
        ods.setUbigeo("ODS-MAIN");

        // 2) Convertir puntos del request a Location
        List<Location> points = request.getPoints()
                .stream()
                .map(dto -> {
                    Location loc = new Location();
                    loc.setId(dto.getId());
                    loc.setName(dto.getName());
                    loc.setLat(dto.getLat());
                    loc.setLng(dto.getLng());
                    loc.setCoords(dto.getLat() + "," + dto.getLng());
                    loc.setOcCount(dto.getOcCount() != null ? dto.getOcCount() : 0);
                    loc.setCategory(dto.getCategory() != null && dto.getCategory().equals("OC") 
                        ? Location.Category.OC 
                        : Location.Category.PC);
                    loc.setUbigeo(dto.getUbigeo() != null ? dto.getUbigeo() : "");
                    loc.setActive(dto.isActive()); 
                    
                    return loc;
                })
                .toList();

        // 3) Construir lista completa: [ODS, ...puntos]
        List<Location> allPoints = new ArrayList<>();
        allPoints.add(ods);
        allPoints.addAll(points);

        // 4) Calcular matriz con OSRM
        double timeFactor = request.getTimeFactor() != null ? request.getTimeFactor() : 1.0;
        
        MatrixService.MatrixResult result = matrixService.calculateMatrix(
            allPoints,
            allPoints,
            timeFactor
        );

        // 5) Preparar labels (nombres de los puntos)
        List<String> labels = allPoints.stream()
                .map(Location::getName)
                .toList();

        // 6) Construir respuesta
        MatrixResponse response = new MatrixResponse();
        response.setDistances(result.distances());
        response.setDurations(result.durations());
        response.setLabels(labels);

        return response;
    }
}