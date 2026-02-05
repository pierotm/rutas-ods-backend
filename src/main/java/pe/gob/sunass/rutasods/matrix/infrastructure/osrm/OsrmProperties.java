package pe.gob.sunass.rutasods.matrix.infrastructure.osrm;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "osrm")
public class OsrmProperties {
    private String baseUrl;
    private String profile;
    private int chunkSize;
    private int timeoutSeconds;
}
