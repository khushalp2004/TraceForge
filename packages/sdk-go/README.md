# TraceForge SDK for Go

TraceForge is a powerful exception tracking and unhandled panic logging platform. This SDK allows you to seamlessly integrate TraceForge into any Go application, with native panic-recovery middleware for **Gin**, **Echo**, and **net/http**.

## Installation

Install the SDK via `go get`:

```bash
go get github.com/khushalp2004/TraceForge/packages/sdk-go@v1.0.2
```

## Basic Configuration

You can use TraceForge in any standard Go application. TraceForge automatically loads credentials from your OS environment variables. 

First, ensure you have your variables set (e.g., via a `.env` file loaded using `godotenv`):
```env
TRACEFORGE_API_KEY="your_api_key_here"
TRACEFORGE_INGEST_URL="https://usetraceforge.com/ingest" # Your TraceForge backend URL
```

Then, initialize the SDK as early as possible in your `main.go`:

```go
package main

import (
    "github.com/joho/godotenv"
    "github.com/khushalp2004/TraceForge/packages/sdk-go"
)

func main() {
    // 1. Load your .env file into os environment variables FIRST!
    _ = godotenv.Load()

    // 2. Initialize TraceForge (automatically reads the environment variables)
    traceforge.Init() 
    
    // ... rest of your code
}
```

---

## Catching Unhandled Panics (Middleware)

If you are building a web application, TraceForge provides native middleware to automatically catch and report unhandled `panic()` events without crashing your server.

### For Gin
Add the middleware to your router:
```go
import tfgin "github.com/khushalp2004/TraceForge/packages/sdk-go/integrations/gin"

r := gin.Default()
r.Use(tfgin.TraceForge())
```

### For Echo
Add the middleware to your router:
```go
import tfecho "github.com/khushalp2004/TraceForge/packages/sdk-go/integrations/echo"

e := echo.New()
e.Use(tfecho.TraceForge())
```

### For net/http
Wrap your multiplexer/router:
```go
import tfhttp "github.com/khushalp2004/TraceForge/packages/sdk-go/integrations/nethttp"

mux := http.NewServeMux()
// ... register routes on mux ...

// Wrap your entire router
log.Fatal(http.ListenAndServe(":8080", tfhttp.TraceForge(mux)))
```

---

## Tracking "Handled" Errors

In Go, most errors are returned as `error` interfaces rather than causing a panic. To track these standard handled errors in TraceForge, you can manually call `CaptureException`:

```go
func HandleDatabase(c *gin.Context) {
    err := db.Query("SELECT * FROM non_existent_table")
    if err != nil {
        // Manually report the handled error to TraceForge
        traceforge.CaptureException(err, map[string]string{"type": "database_error"}, map[string]any{"url": c.Request.URL.Path})
        
        c.JSON(500, gin.H{"error": "Database error occurred"})
        return
    }
}
```

## Tracking 404 Not Found (Gin)

404 errors are triggered by the router itself, not a specific handler, so they aren't caught by standard middleware. You can explicitly track 404s in Gin using `NoRoute`:

```go
r.NoRoute(func(c *gin.Context) {
    err := fmt.Errorf("route not found: %s", c.Request.URL.Path)
    traceforge.CaptureException(err, map[string]string{"type": "404_not_found"}, map[string]any{
        "url":    c.Request.URL.String(),
        "method": c.Request.Method,
        "ip":     c.ClientIP(),
    })
    c.JSON(404, gin.H{"error": "Route not found"})
})
```

---

## Using Custom Recovery Middleware?

If you already use a custom `Recovery()` middleware to format your own JSON error responses, your custom middleware will swallow the panic before TraceForge can see it. 

To fix this, simply remove the TraceForge middleware and inject `traceforge.CapturePanic` directly into your custom recover block:

```go
func MyCustomRecovery() gin.HandlerFunc {
    return func(c *gin.Context) {
        defer func() {
            if err := recover(); err != nil {
                // 1. Manually send to TraceForge!
                traceforge.CapturePanic(err, debug.Stack(), map[string]string{"framework": "gin"}, nil)
                
                // 2. Return your beautiful custom JSON response
                c.AbortWithStatusJSON(500, gin.H{"success": false, "message": "My custom error!"})
            }
        }()
        c.Next()
    }
}
```
