package pe.gob.sunass.rutasods.optimization.application.internal;

import org.springframework.stereotype.Service;
import pe.gob.sunass.rutasods.costing.domain.CostCalculator;
import pe.gob.sunass.rutasods.matrix.application.internal.MatrixService;
import pe.gob.sunass.rutasods.optimization.domain.services.GreedyRoutePlanner;
import pe.gob.sunass.rutasods.optimization.domain.services.ItineraryCalculator;
import pe.gob.sunass.rutasods.optimization.domain.services.DistanceEvaluator;
import pe.gob.sunass.rutasods.optimization.infrastructure.cache.OptimizationCacheService;
import pe.gob.sunass.rutasods.optimization.infrastructure.cache.OptimizationSnapshot;
import pe.gob.sunass.rutasods.optimization.interfaces.rest.dto.*;
import pe.gob.sunass.rutasods.shared.domain.model.*;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import java.time.Instant;
import java.util.UUID;

import java.util.Arrays;


@Service
public class RunMasterPlanUseCase {

    private final MatrixService matrixService;
    private final OptimizationCacheService cacheService;

    public RunMasterPlanUseCase(MatrixService matrixService, OptimizationCacheService cacheService) {
        this.matrixService = matrixService;
        this.cacheService = cacheService;
    }

    public OptimizeResponse execute(OptimizeRequest request) {

        // 1) construir ODS como Location
        Location ods = new Location();
        ods.setId(-1L);
        ods.setName("ODS (Base)");
        ods.setLat(request.getOds().lat);
        ods.setLng(request.getOds().lng);
        ods.setCoords(
                request.getOds().lat + "," +
                        request.getOds().lng);
        ods.setCategory(Location.Category.PC);
        ods.setActive(true);
        ods.setUbigeo("ODS-MAIN");

        // 2) filtrar activos y aplicar coverageLimit
        List<Location> active =
                request.getPoints()
                        .stream()
                        .filter(LocationDto::isActive)
                        .limit(request.getCoverageLimit() != null
                                ? request.getCoverageLimit()
                                : Integer.MAX_VALUE)
                        .map(LocationDto::toDomain)
                        .toList();

        List<Location> allPoints =
                new ArrayList<>();
        allPoints.add(ods);
        allPoints.addAll(active);

        // 3) matriz OSRM
        MatrixService.MatrixResult matrix =
                matrixService.calculateMatrix(
                        allPoints,
                        allPoints,
                        request.getTimeFactor() != null
                                ? request.getTimeFactor()
                                : 1.0);

        double[][] distances =
                matrix.distances();

        double[][] durations =
                matrix.durations();

        System.out.println("========== MATRIX DISTANCES ==========");
        for (double[] row : distances) {
            System.out.println(Arrays.toString(row));
        }

        System.out.println("========== MATRIX DURATIONS ==========");
        for (double[] row : durations) {
            System.out.println(Arrays.toString(row));
        }

        // 4) instanciar dominio
        ItineraryCalculator itineraryCalculator =
                new ItineraryCalculator();

        CostCalculator costCalculator =
                new CostCalculator();

        GreedyRoutePlanner planner =
                new GreedyRoutePlanner(
                        itineraryCalculator,
                        costCalculator);

        // 5) índices activos (1..n)
        List<Integer> activeIdx =
                IntStream.range(1,
                                allPoints.size())
                        .boxed()
                        .toList();

        // 6) ejecutar greedy
        System.out.println(
                "pcDuration=" + request.getPcDuration() +
                        " ocDuration=" + request.getOcDuration()
        );

        List<RouteSegment> routes =
                planner.planRoutes(
                        allPoints,
                        activeIdx,
                        distances,
                        durations,
                        request.getPcDuration() != null
                                ? request.getPcDuration()
                                : 180,
                        request.getOcDuration() != null
                                ? request.getOcDuration()
                                : 180,
                        request.getCosts() != null
                                ? request.getCosts().km
                                : 1.0,
                        request.getCosts() != null
                                ? request.getCosts().food
                                : 180,
                        request.getCosts() != null
                                ? request.getCosts().hotel
                                : 570,
                        (a, b) -> true // isValidConnection stub
                );


        // 7) totales
        double totalSystemCost =
                routes.stream()
                        .mapToDouble(RouteSegment::getTotalCost)
                        .sum();

        double totalDistance =
                routes.stream()
                        .mapToDouble(RouteSegment::getDistance)
                        .sum();

        int totalNights =
                routes.stream()
                        .mapToInt(RouteSegment::getNights)
                        .sum();

        int totalDays =
                routes.stream()
                        .mapToInt(RouteSegment::getDays)
                        .sum();

        // 8-A) guardar snapshot en cache

        String sessionId = UUID.randomUUID().toString();

        OptimizationSnapshot snapshot =
                new OptimizationSnapshot(
                        routes,
                        distances,
                        durations,

                        allPoints.stream()
                                .map(Location::getName)
                                .toList(),

                        request.getCosts() != null
                                ? request.getCosts().km
                                : 1.0,

                        request.getCosts() != null
                                ? request.getCosts().food
                                : 180,

                        request.getCosts() != null
                                ? request.getCosts().hotel
                                : 570,

                        request.getPcDuration() != null
                                ? request.getPcDuration()
                                : 180,

                        request.getOcDuration() != null
                                ? request.getOcDuration()
                                : 180,

                        // 🔥 NUEVO PARÁMETRO: timeFactor
                        request.getTimeFactor() != null
                                ? request.getTimeFactor()
                                : 1.0,

                        Instant.now()
                );

        cacheService.save(sessionId, snapshot);

        // 8) mapear response
        OptimizeResponse response =
                new OptimizeResponse();


        response.setSessionId(sessionId);

        response.setRoutes(
                routes.stream()
                        .map(RouteSegmentDto::fromDomain)
                        .toList());

        response.setTotalSystemCost(
                totalSystemCost);

        response.setTotalDistance(
                totalDistance);

        response.setTotalNights(
                totalNights);

        response.setTotalDays(
                totalDays);

        response.setPointsCovered(
                active.size());

        System.out.println("ODS = " + request.getOds());
        System.out.println("Points = " + request.getPoints());


        return response;
    }
}
