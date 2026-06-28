package tfgin

import (
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"
	"github.com/khushalp2004/TraceForge/packages/sdk-go"
)

// TraceForge is a Gin middleware that recovers from any panics and writes a 500 if there was one.
// It logs the panic and sends the payload asynchronously to TraceForge.
func TraceForge() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				// Capture stack trace
				stack := debug.Stack()
				
				// Extract request payload data
				payload := map[string]any{
					"url":    c.Request.URL.String(),
					"method": c.Request.Method,
					"ip":     c.ClientIP(),
				}
				
				// Send to TraceForge
				traceforge.CapturePanic(err, stack, map[string]string{"framework": "gin"}, payload)
				
				// Return a generic 500 Internal Server Error response
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": "Internal Server Error",
				})
			}
		}()
		
		c.Next()
	}
}
