package com.usetraceforge.spring;

import com.usetraceforge.TraceForge;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

@ControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceForgeExceptionHandler {

    public TraceForgeExceptionHandler() {
        System.out.println("[TraceForge] Global Exception Handler registered successfully.");
    }

    @ExceptionHandler(Exception.class)
    public void handleAllExceptions(Exception ex) throws Exception {
        // Capture the exception
        TraceForge.captureException(ex);
        
        // Re-throw the exception so Spring Boot can still return a 500 error page / JSON response
        throw ex;
    }
}
