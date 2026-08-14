package com.usetraceforge;

import java.util.HashMap;
import java.util.Map;

public class Config {
    private String apiKey;
    private String endpoint = "http://localhost:3001/ingest";
    private String environment = "";
    private String release = "";
    private Map<String, String> tags = new HashMap<>();

    public Config() {}

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public String getEnvironment() { return environment; }
    public void setEnvironment(String environment) { this.environment = environment; }

    public String getRelease() { return release; }
    public void setRelease(String release) { this.release = release; }

    public Map<String, String> getTags() { return tags; }
    public void setTags(Map<String, String> tags) { this.tags = tags; }
}
