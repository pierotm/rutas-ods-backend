package pe.gob.sunass.rutasods.optimization.infrastructure.cache;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class OptimizationCacheService {

    private final Map<String, OptimizationSnapshot> cache =
            new ConcurrentHashMap<>();

    public void save(String sessionId,
                     OptimizationSnapshot snapshot) {
        cache.put(sessionId, snapshot);
    }

    public OptimizationSnapshot get(String sessionId) {
        return cache.get(sessionId);
    }

    public void evict(String sessionId) {
        cache.remove(sessionId);
    }

    public OptimizationSnapshot getOrThrow(String sessionId) {
        OptimizationSnapshot snapshot = get(sessionId); // como lo tengas implementado
        if (snapshot == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found: " + sessionId);
        }
        return snapshot;
    }

}
