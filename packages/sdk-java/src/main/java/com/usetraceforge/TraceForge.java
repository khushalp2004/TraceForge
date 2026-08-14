package com.usetraceforge;

import io.github.cdimascio.dotenv.Dotenv;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

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
        
        // Load from .env if present
        try {
            Dotenv dotenv = Dotenv.configure().ignoreIfMissing().load();
            if (config.getApiKey() == null || config.getApiKey().isEmpty()) {
                config.setApiKey(dotenv.get("TRACEFORGE_API_KEY"));
            }
            if (config.getEndpoint() == null || config.getEndpoint().isEmpty()) {
                String envEndpoint = dotenv.get("TRACEFORGE_INGEST_URL");
                config.setEndpoint(envEndpoint != null ? envEndpoint : "http://127.0.0.1:80/ingest");
            }
        } catch (Exception e) {
            // Ignore dotenv errors
        }

        if (config.getEndpoint() == null || config.getEndpoint().isEmpty()) {
            config.setEndpoint("http://127.0.0.1:80/ingest");
        }
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

    public static void captureException(Throwable exception) {
        if (config == null || config.getApiKey() == null || config.getApiKey().isEmpty()) {
            System.err.println("[TraceForge] Missing API Key. Cannot send error.");
            return;
        }

        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        exception.printStackTrace(pw);
        String stackTrace = sw.toString();

        String file = "unknown_file";
        int line = 0;

        StackTraceElement[] elements = exception.getStackTrace();
        if (elements != null && elements.length > 0) {
            StackTraceElement first = elements[0];
            file = first.getFileName() != null ? first.getFileName() : first.getClassName();
            line = first.getLineNumber() > 0 ? first.getLineNumber() : 0;
        }

        String payload = String.format(
                "{\"type\":\"error\",\"message\":\"%s\",\"stackTrace\":\"%s\",\"file\":\"%s\",\"line\":%d,\"metadata\":{\"framework\":\"spring-boot\",\"language\":\"java\"}}",
                escapeJson(exception.getMessage() != null ? exception.getMessage() : exception.getClass().getSimpleName()),
                escapeJson(stackTrace),
                escapeJson(file),
                line
        );

        sendPostRequest(config.getEndpoint(), payload);
    }

    private static void sendPostRequest(String url, String jsonPayload) {
        System.out.println("[TraceForge] Sending POST to URL: " + url);
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(2))
                    .header("Content-Type", "application/json")
                    .header("X-Traceforge-Key", config.getApiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            // Send asynchronously to avoid blocking the main thread
            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .whenComplete((response, throwable) -> {
                    if (throwable != null) {
                        System.err.println("[TraceForge] Failed to send error payload: " + throwable.getMessage());
                        throwable.printStackTrace();
                    } else if (response.statusCode() >= 400) {
                        System.err.println("[TraceForge] Server rejected payload with status " + response.statusCode() + ": " + response.body());
                    } else {
                        System.out.println("[TraceForge] Successfully sent error to backend!");
                    }
                });
        } catch (Exception e) {
            System.err.println("[TraceForge] Exception preparing network request: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
