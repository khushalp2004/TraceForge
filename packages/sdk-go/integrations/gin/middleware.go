package tfgin

import (
	"bytes"
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"
	"github.com/khushalp2004/TraceForge/packages/sdk-go"
)

type responseBodyWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w responseBodyWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// TraceForge is a zero-touch Gin middleware.
// It catches panics AND automatically intercepts any 4xx/5xx responses to log them in TraceForge.
func TraceForge() gin.HandlerFunc {
	return func(c *gin.Context) {
		w := &responseBodyWriter{body: &bytes.Buffer{}, ResponseWriter: c.Writer}
		c.Writer = w

		defer func() {
			// Catch Panics
			if err := recover(); err != nil {
				stack := debug.Stack()
				payload := map[string]any{
					"url":    c.Request.URL.String(),
					"method": c.Request.Method,
					"ip":     c.ClientIP(),
				}
				traceforge.CapturePanic(err, stack, map[string]string{"framework": "gin", "type": "panic"}, payload)
				
				// Standard panic response
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"error": "Internal Server Error",
				})
			}
		}()
		
		c.Next()

		// Intercept errors returned by standard handlers
		status := c.Writer.Status()
		if status >= 400 {
			errMessage := fmt.Sprintf("HTTP %d Error", status)
			responseBody := w.body.String()
			
			payload := map[string]any{
				"url":      c.Request.URL.String(),
				"method":   c.Request.Method,
				"ip":       c.ClientIP(),
				"status":   status,
				"response": responseBody,
			}
			
			err := fmt.Errorf(errMessage)
			traceforge.CaptureException(err, map[string]string{
				"framework": "gin", 
				"type": "http_error",
				"status_code": fmt.Sprintf("%d", status),
			}, payload)
		}
	}
}
