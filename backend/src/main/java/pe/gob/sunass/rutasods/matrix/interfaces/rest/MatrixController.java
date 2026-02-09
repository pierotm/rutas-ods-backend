package pe.gob.sunass.rutasods.matrix.interfaces.rest;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
    public ResponseEntity<?> calculateMatrix(@Valid @RequestBody MatrixRequest request) {
        
        try {
            // ✅ LOGS DE DEBUG
            System.out.println("========== MATRIZ CALCULATE REQUEST ==========");
            System.out.println("ODS recibido: " + request.getOds());
            System.out.println("Cantidad de puntos: " + (request.getPoints() != null ? request.getPoints().size() : 0));
            System.out.println("Time Factor: " + request.getTimeFactor());
            
            // ✅ VALIDACIÓN DEFENSIVA
            if (request.getOds() == null) {
                return ResponseEntity.badRequest().body("ODS coordinates are required");
            }
            
            if (request.getOds().getLat() == null || request.getOds().getLng() == null) {
                return ResponseEntity.badRequest().body("ODS lat/lng cannot be null");
            }
            
            if (request.getPoints() == null || request.getPoints().isEmpty()) {
                return ResponseEntity.badRequest().body("At least one point is required");
            }
            
            // 1) Construir ODS como Location
            System.out.println("✅ Construyendo ODS...");
            Location ods = new Location();
            ods.setId(-1L);
            ods.setName("ODS (Base)");
            ods.setLat(request.getOds().getLat());
            ods.setLng(request.getOds().getLng());
            ods.setCoords(request.getOds().getLat() + "," + request.getOds().getLng());
            ods.setCategory(Location.Category.PC);
            ods.setActive(true);
            ods.setUbigeo("ODS-MAIN");
            
            System.out.println("✅ ODS creado: " + ods.getName() + " [" + ods.getLat() + ", " + ods.getLng() + "]");

            // 2) Convertir puntos del request a Location
            System.out.println("✅ Convirtiendo puntos...");
            List<Location> points = new ArrayList<>();
            
            for (MatrixRequest.PointDto dto : request.getPoints()) {
                if (dto.getLat() == null || dto.getLng() == null) {
                    System.err.println("⚠️ Punto con coordenadas nulas: " + dto.getName());
                    continue;
                }
                
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
                
                points.add(loc);
            }
            
            System.out.println("✅ Puntos convertidos: " + points.size());

            // 3) Construir lista completa: [ODS, ...puntos]
            List<Location> allPoints = new ArrayList<>();
            allPoints.add(ods);
            allPoints.addAll(points);
            
            System.out.println("✅ Total de puntos (incluyendo ODS): " + allPoints.size());

            // 4) Calcular matriz con OSRM
            double timeFactor = request.getTimeFactor() != null ? request.getTimeFactor() : 1.0;
            
            System.out.println("✅ Llamando a OSRM MatrixService con timeFactor=" + timeFactor + "...");
            MatrixService.MatrixResult result = matrixService.calculateMatrix(
                allPoints,
                allPoints,
                timeFactor
            );
            
            System.out.println("✅ Matriz calculada exitosamente");
            System.out.println("   - Distancias: " + result.distances().length + "x" + result.distances()[0].length);
            System.out.println("   - Duraciones: " + result.durations().length + "x" + result.durations()[0].length);

            // 5) Preparar labels (nombres de los puntos)
            List<String> labels = allPoints.stream()
                    .map(Location::getName)
                    .toList();
            
            System.out.println("✅ Labels generados: " + labels.size());

            // 6) Construir respuesta
            MatrixResponse response = new MatrixResponse();
            response.setDistances(result.distances());
            response.setDurations(result.durations());
            response.setLabels(labels);
            
            System.out.println("========== MATRIZ CALCULATE SUCCESS ==========");

            return ResponseEntity.ok(response);
            
        } catch (IllegalStateException e) {
            System.err.println("========== ERROR OSRM ==========");
            System.err.println("Mensaje: " + e.getMessage());
            e.printStackTrace();
            System.err.println("================================");
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body("Error comunicándose con OSRM: " + e.getMessage());
            
        } catch (Exception e) {
            System.err.println("========== ERROR EN MATRIZ CALCULATE ==========");
            System.err.println("Tipo de error: " + e.getClass().getName());
            System.err.println("Mensaje: " + e.getMessage());
            e.printStackTrace();
            System.err.println("===============================================");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error interno: " + e.getMessage());
        }
    }
}