package tfhttp

import (
	"encoding/json"
	"net/http"
	"runtime/debug"

	"github.com/khushalp2004/TraceForge/packages/sdk-go"
)

// TraceForge wraps an http.Handler with panic recovery and reporting.
func TraceForge(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				stack := debug.Stack()
				
				payload := map[string]any{
					"url":    r.URL.String(),
					"method": r.Method,
					"ip":     r.RemoteAddr,
				}
				
				traceforge.CapturePanic(err, stack, map[string]string{"framework": "net/http"}, payload)
				
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "Internal Server Error",
				})
			}
		}()
		next.ServeHTTP(w, r)
	})
}
