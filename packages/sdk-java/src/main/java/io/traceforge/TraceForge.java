package io.traceforge;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

public class TraceForge {
    private static Config config;
    private static boolean isSetup = false;
    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    public static void init(String apiKey) {
        Config c = new Config();
        c.setApiKey(apiKey);
        initWithConfig(c);
    }

    public static void initWithConfig(Config c) {
        config = c;
        if (config.getEndpoint() == null || config.getEndpoint().isEmpty()) {
            config.setEndpoint("http://localhost:3001/ingest");
        }
        sendSetupHandshake();
    }

    private static String getSetupEndpoint() {
        String endpoint = config.getEndpoint();
        if (endpoint.endsWith("/")) {
            endpoint = endpoint.substring(0, endpoint.length() - 1);
        }
        if (endpoint.endsWith("/setup")) {
            return endpoint;
        }
        return endpoint + "/setup";
    }

    private static String mapToJson(Map<String, String> map) {
        StringBuilder json = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, String> entry : map.entrySet()) {
            if (!first) json.append(",");
            json.append("\"").append(escapeJson(entry.getKey())).append("\":\"")
                .append(escapeJson(entry.getValue())).append("\"");
            first = false;
        }
        json.append("}");
        return json.toString();
    }

    private static String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\b", "\\b")
                  .replace("\f", "\\f")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t");
    }

    private static void sendSetupHandshake() {
        if (config == null || config.getApiKey() == null || config.getApiKey().isEmpty() || isSetup) {
            return;
        }

        isSetup = true;

        String tagsJson = mapToJson(config.getTags());
        String payload = String.format("{\"environment\":\"%s\",\"release\":\"%s\",\"tags\":%s}",
                escapeJson(config.getEnvironment()),
                escapeJson(config.getRelease()),
                tagsJson);

        sendPostRequest(getSetupEndpoint(), payload);
    }

    public static void captureException(Throwable exception) {
        if (config == null || config.getApiKey() == null || config.getApiKey().isEmpty()) {
            return;
        }

        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        exception.printStackTrace(pw);
        String stackTrace = sw.toString();

        String tagsJson = mapToJson(config.getTags());
        String payload = String.format(
                "{\"message\":\"%s\",\"stackTrace\":\"%s\",\"environment\":\"%s\",\"release\":\"%s\",\"tags\":%s}",
                escapeJson(exception.getMessage()),
                escapeJson(stackTrace),
                escapeJson(config.getEnvironment()),
                escapeJson(config.getRelease()),
                tagsJson
        );

        sendPostRequest(config.getEndpoint(), payload);
    }

    private static void sendPostRequest(String url, String jsonPayload) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(2))
                    .header("Content-Type", "application/json")
                    .header("X-Traceforge-Key", config.getApiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            // Send asynchronously to avoid blocking the main thread
            httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            // Silently fail network exceptions
        }
    }
}
