package pe.gob.sunass.rutasods.matrix.infrastructure.osrm;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.util.retry.Retry;

import java.time.Duration;

@Component
public class OsrmClient {

    private final WebClient webClient;
    private final OsrmProperties props;

    public OsrmClient(WebClient webClient, OsrmProperties props) {
        this.webClient = webClient;
        this.props = props;
    }

    public OsrmTableResponse table(String coordinates, int sourcesCount, int destinationsCount) {
        // OSRM table: /table/v1/{profile}/{coords}?annotations=duration,distance
        // coords: "lon,lat;lon,lat;..."
        // sources=0;1;2...
        // destinations=0;1;2...

        String sources = buildIndexList(0, sourcesCount);
        String destinations = buildIndexList(sourcesCount, sourcesCount + destinationsCount);

        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .scheme("https")
                        .host(props.getBaseUrl().replace("https://", "").replace("http://", ""))
                        .path("/table/v1/" + props.getProfile() + "/" + coordinates)
                        .queryParam("annotations", "duration,distance")
                        .queryParam("sources", sources)
                        .queryParam("destinations", destinations)
                        .build())
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .bodyToMono(OsrmTableResponse.class)
                //.timeout(Duration.ofSeconds(props.getTimeoutSeconds()))
                .retryWhen(Retry.backoff(2, Duration.ofMillis(400))
                        .maxBackoff(Duration.ofSeconds(2)))
                .block();
    }

    private String buildIndexList(int startInclusive, int endExclusive) {
        StringBuilder sb = new StringBuilder();
        for (int i = startInclusive; i < endExclusive; i++) {
            if (i > startInclusive) sb.append(';');
            sb.append(i);
        }
        return sb.toString();
    }
}
