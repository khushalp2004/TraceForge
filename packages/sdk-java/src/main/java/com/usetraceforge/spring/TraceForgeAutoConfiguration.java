package com.usetraceforge.spring;

import com.usetraceforge.Config;
import com.usetraceforge.TraceForge;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

import jakarta.annotation.PostConstruct;

@AutoConfiguration
@ConditionalOnWebApplication
@EnableConfigurationProperties(TraceForgeProperties.class)
public class TraceForgeAutoConfiguration {

    private final TraceForgeProperties properties;

    public TraceForgeAutoConfiguration(TraceForgeProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    public void initTraceForge() {
        Config config = new Config();
        
        // Let .env values take precedence inside TraceForge.java, but use these as fallbacks if set in application.properties
        if (properties.getApiKey() != null) {
            config.setApiKey(properties.getApiKey());
        }
        if (properties.getIngestUrl() != null) {
            config.setEndpoint(properties.getIngestUrl());
        }

        TraceForge.initWithConfig(config);
        System.out.println("[TraceForge] Spring Boot Auto-Configuration initialized.");
    }

    @Bean
    public TraceForgeExceptionHandler traceForgeExceptionHandler() {
        return new TraceForgeExceptionHandler();
    }
}
