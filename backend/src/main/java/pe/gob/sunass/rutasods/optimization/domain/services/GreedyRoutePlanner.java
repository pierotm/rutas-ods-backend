package pe.gob.sunass.rutasods.optimization.domain.services;

import pe.gob.sunass.rutasods.costing.domain.CostCalculator;
import pe.gob.sunass.rutasods.optimization.domain.model.CandidateRoute;
import pe.gob.sunass.rutasods.shared.domain.model.*;
import pe.gob.sunass.rutasods.shared.domain.rules.OptimizationRules;
import pe.gob.sunass.rutasods.shared.domain.rules.RoutingRules;

import java.util.*;

public class GreedyRoutePlanner {

    private final ItineraryCalculator itineraryCalculator;
    private final CostCalculator costCalculator;

    public GreedyRoutePlanner(
            ItineraryCalculator itineraryCalculator,
            CostCalculator costCalculator
    ) {
        this.itineraryCalculator = itineraryCalculator;
        this.costCalculator = costCalculator;
    }

    public List<RouteSegment> planRoutes(
            List<Location> allPoints,
            List<Integer> activeIndices,
            double[][] distances,
            double[][] durations,
            int pcDuration,
            int ocDuration,
            double kmCost,
            double foodCost,
            double hotelCost,
            DistanceEvaluator.ConnectionValidator validator
    ) {

        DistanceEvaluator evaluator =
                new DistanceEvaluator(distances);

        List<RouteSegment> finalRoutes = new ArrayList<>();

        List<Integer> available = new ArrayList<>(activeIndices);

        int routeCounter = 1;

        while (!available.isEmpty()) {

            // A) farthest from ODS
            int farthest = available.get(0);
            double maxDist = -1;

            for (int idx : available) {
                double d = evaluator.getDist(0, idx, allPoints.get(0), allPoints.get(idx), validator);
                if (d > maxDist && d != Double.POSITIVE_INFINITY) {
                    maxDist = d;
                    farthest = idx;
                }
            }

            // Si el viaje es > 240min, forzar que el inicio sea una PC
            double travelTimeToFarthest = durations[0][farthest];
            if (travelTimeToFarthest > 240) {
                // Buscar la PC más cercana a ese punto 'farthest' para que sea el primer destino
                int bestPcIdx = farthest;
                double minToPc = Double.MAX_VALUE;

                for (int idx : available) {
                    if (allPoints.get(idx).getCategory() == Location.Category.PC) {
                        double d = distances[farthest][idx];
                        if (d < minToPc) {
                            minToPc = d;
                            bestPcIdx = idx;
                        }
                    }
                }
                farthest = bestPcIdx; // Ahora el cluster empezará por esta PC
            }

            // B) neighbors
            List<Integer> neighbors = new ArrayList<>(available);
            neighbors.remove(Integer.valueOf(farthest));

            final int farthestIdx = farthest;

            neighbors.sort(Comparator.comparingDouble(
                    i -> evaluator.getDist(
                            farthestIdx,
                            i,
                            allPoints.get(farthestIdx),
                            allPoints.get(i),
                            validator)
            ));


            neighbors = neighbors.stream()
                    .limit(OptimizationRules.SEARCH_POOL_SIZE)
                    .toList();

            CandidateRoute bestCandidate = null;

            int maxNeighborsToAdd =
                    Math.min(neighbors.size(),
                            OptimizationRules.MAX_COMBO_SIZE - 1);

            for (int k = 0; k <= maxNeighborsToAdd; k++) {

                List<List<Integer>> combos =
                        combinations(neighbors, k);

                for (List<Integer> combo : combos) {

                    List<Integer> cluster =
                            new ArrayList<>();
                    cluster.add(farthest);
                    cluster.addAll(combo);

                    List<List<Integer>> perms =
                            permutations(cluster);

                    for (List<Integer> perm : perms) {

                        List<Integer> path =
                                new ArrayList<>();
                        path.add(0);
                        path.addAll(perm);

                        ItineraryResult itin =
                                itineraryCalculator.calculate(
                                        path,
                                        allPoints,
                                        durations,
                                        pcDuration,
                                        ocDuration);

                        System.out.println(
                                "\n[ITIN TEST] perm=" + perm +
                                        " days=" + itin.getNumDays() +
                                        " nights=" + itin.getNumNights()
                        );


                        if (itin.getNumDays()
                                > RoutingRules.MAX_ROUTE_DAYS)
                            continue;

                        double distanceKm =
                                computePathDistance(
                                        perm,
                                        allPoints,
                                        evaluator,
                                        validator);

                        /*double distanceKm = distanceMeters /1000.0;*/

                        System.out.println(
                                "[DIST TEST] perm=" + perm +
                                        " km=" + String.format("%.2f", distanceKm)
                        );


                        double totalCost =
                                costCalculator.computeTotalCost(
                                        distanceKm,
                                        itin.getNumDays(),
                                        itin.getNumNights(),
                                        perm.stream()
                                                .map(allPoints::get)
                                                .toList(),
                                        kmCost,
                                        foodCost,
                                        hotelCost);

                        System.out.println(
                                "[COST TEST] perm=" + perm +
                                        " days=" + itin.getNumDays() +
                                        " nights=" + itin.getNumNights() +
                                        " cost=" + totalCost
                        );


                        // Nueva métrica con factor de penalización por dispersión (ejemplo: +10% por cada 100km)
                        double dispersionPenalty = 1.0 + (distanceKm / 1000.0);
                        double metric = (totalCost / perm.size()) * dispersionPenalty;

                        if (bestCandidate == null ||
                                metric < bestCandidate.getMetric()) {

                            System.out.println(
                                    "[BEST UPDATE] perm=" + perm +
                                            " metric=" + metric +
                                            " cost=" + totalCost +
                                            " days=" + itin.getNumDays() +
                                            " nights=" + itin.getNumNights()
                            );


                            CandidateRoute c =
                                    new CandidateRoute();
                            c.setPerm(perm);
                            c.setCost(totalCost);
                            c.setMetric(metric);
                            c.setItinerary(itin);
                            c.setBreakdown(
                                    costCalculator.breakdown(
                                            distanceKm,
                                            itin.getNumDays(),
                                            itin.getNumNights(),
                                            perm.stream()
                                                    .map(allPoints::get)
                                                    .toList(),
                                            kmCost,
                                            foodCost,
                                            hotelCost));

                            bestCandidate = c;
                        }
                    }
                }
            }

            if (bestCandidate != null) {

                double routeDistanceKm =
                        computePathDistance(
                                bestCandidate.getPerm(),
                                allPoints,
                                evaluator,
                                validator
                        );



                RouteSegment route =
                        new RouteSegment();

                route.setId((long) routeCounter);
                route.setName("Ruta " + routeCounter);
                route.setPoints(
                        bestCandidate.getPerm()
                                .stream()
                                .map(allPoints::get)
                                .toList());

                route.setLogs(
                        bestCandidate.getItinerary()
                                .getLogs());

                route.setTotalCost(
                        bestCandidate.getCost());

                route.setBreakdown(
                        bestCandidate.getBreakdown());

                route.setDistance(routeDistanceKm);
                System.out.println(String.format(
                        "Ruta %d -> distancia (km) = %.3f",
                        route.getId(),
                        routeDistanceKm));
                route.setDays(bestCandidate.getItinerary().getNumDays());
                route.setNights(bestCandidate.getItinerary().getNumNights());

                System.out.println(
                        "\n[FINAL ROUTE] Ruta " + route.getId() +
                                " perm=" + bestCandidate.getPerm() +
                                " km=" + (routeDistanceKm) +
                                " days=" + route.getDays() +
                                " nights=" + route.getNights() +
                                " cost=" + route.getTotalCost()
                );


                routeCounter++;

                finalRoutes.add(route);

                available.removeAll(
                        bestCandidate.getPerm());
            } else {
                // fallback simple
                int idx = available.remove(0);

                List<Integer> path =
                        List.of(0, idx);

                ItineraryResult itin =
                        itineraryCalculator.calculate(
                                path,
                                allPoints,
                                durations,
                                pcDuration,
                                ocDuration);


                double dKm =
                        (distances[0][idx] * 2);
                /*double dKm = dMeters / 1000.0;*/

                RouteSegment r = new RouteSegment();
                r.setName("Ruta fallback");
                r.setPoints(
                        List.of(allPoints.get(idx)));
                r.setLogs(itin.getLogs());
                r.setDistance(dKm);
                finalRoutes.add(r);
            }
        }


        return finalRoutes;
    }

    // ---------------- helpers -----------------

    private double computePathDistance(
            List<Integer> perm,
            List<Location> allPoints,
            DistanceEvaluator evaluator,
            DistanceEvaluator.ConnectionValidator validator
    ) {

        double d = evaluator.getDist(
                0,
                perm.get(0),
                allPoints.get(0),
                allPoints.get(perm.get(0)),
                validator);

        for (int i = 0; i < perm.size() - 1; i++) {
            d += evaluator.getDist(
                    perm.get(i),
                    perm.get(i + 1),
                    allPoints.get(perm.get(i)),
                    allPoints.get(perm.get(i + 1)),
                    validator);
        }

        d += evaluator.getDist(
                perm.get(perm.size() - 1),
                0,
                allPoints.get(perm.get(perm.size() - 1)),
                allPoints.get(0),
                validator);

        return d;
    }

    private <T> List<List<T>> combinations(
            List<T> input,
            int k
    ) {
        List<List<T>> res = new ArrayList<>();
        backtrackComb(res, new ArrayList<>(),
                input, k, 0);
        return res;
    }

    private <T> void backtrackComb(
            List<List<T>> res,
            List<T> curr,
            List<T> input,
            int k,
            int idx
    ) {
        if (curr.size() == k) {
            res.add(new ArrayList<>(curr));
            return;
        }
        for (int i = idx; i < input.size(); i++) {
            curr.add(input.get(i));
            backtrackComb(res, curr,
                    input, k, i + 1);
            curr.remove(curr.size() - 1);
        }
    }

    private <T> List<List<T>> permutations(
            List<T> input
    ) {
        List<List<T>> res = new ArrayList<>();
        permute(res,
                new ArrayList<>(),
                input,
                new boolean[input.size()]);
        return res;
    }

    private <T> void permute(
            List<List<T>> res,
            List<T> curr,
            List<T> input,
            boolean[] used
    ) {
        if (curr.size() == input.size()) {
            res.add(new ArrayList<>(curr));
            return;
        }
        for (int i = 0; i < input.size(); i++) {
            if (used[i]) continue;
            used[i] = true;
            curr.add(input.get(i));
            permute(res, curr, input, used);
            curr.remove(curr.size() - 1);
            used[i] = false;
        }
    }
}
