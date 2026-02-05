package pe.gob.sunass.rutasods.optimization.interfaces.rest.dto;

import lombok.Getter;
import lombok.Setter;
import pe.gob.sunass.rutasods.shared.domain.model.RouteSegment;

import java.util.List;
import java.util.stream.Collectors;

@Getter
@Setter
public class RouteSegmentDto {

    private Long id;
    private String name;
    private double totalCost;
    private double distance;
    private int nights;
    private int days;
    
    // NUEVOS CAMPOS
    private List<LocationDto> points;
    private List<DayLogDto> logs; // El detalle diario
    private CostBreakdownDto breakdown; // Opcional, para el desglose de S/.

    public static RouteSegmentDto fromDomain(RouteSegment r) {
        RouteSegmentDto dto = new RouteSegmentDto();

        dto.setId(r.getId());
        dto.setName(r.getName());
        dto.setTotalCost(r.getTotalCost());
        dto.setDistance(r.getDistance());
        dto.setNights(r.getNights());
        dto.setDays(r.getDays());

        // Mapeo de Puntos (Sequence)
        dto.setPoints(r.getPoints().stream()
                .map(p -> {
                    LocationDto ld = new LocationDto();
                    ld.setId(p.getId());
                    ld.setName(p.getName());
                    ld.setLat(p.getLat());
                    ld.setLng(p.getLng());
                    ld.setOcCount(p.getOcCount());
                    ld.setCategory(p.getCategory().name());
                    ld.setUbigeo(p.getUbigeo());
                    ld.setActive(p.isActive());
                    return ld;
                }).toList());

        if (r.getLogs() != null) {
            dto.setLogs(r.getLogs().stream()
                    .map(DayLogDto::fromDomain) 
                    .toList());
        }

        return dto;
    }
}