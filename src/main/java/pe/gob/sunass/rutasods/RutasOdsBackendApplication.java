package pe.gob.sunass.rutasods;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import pe.gob.sunass.rutasods.matrix.infrastructure.osrm.OsrmProperties;

@SpringBootApplication
@EnableConfigurationProperties(OsrmProperties.class)
public class RutasOdsBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(RutasOdsBackendApplication.class, args);
	}

}
