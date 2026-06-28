package tfhttp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/khushalp2004/TraceForge/packages/sdk-go"
)

type responseBodyWriter struct {
	http.ResponseWriter
	body   *bytes.Buffer
	status int
}

func (w *responseBodyWriter) WriteHeader(statusCode int) {
	w.status = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *responseBodyWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func TraceForge(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rbw := &responseBodyWriter{
			ResponseWriter: w,
			body:           &bytes.Buffer{},
			status:         200, // default status
		}

		defer func() {
			if err := recover(); err != nil {
				stack := debug.Stack()
				payload := map[string]any{
					"url":    r.URL.String(),
					"method": r.Method,
					"ip":     r.RemoteAddr,
				}
				traceforge.CapturePanic(err, stack, map[string]string{"framework": "nethttp", "type": "panic"}, payload)
				
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{"error": "Internal Server Error"})
			}
		}()

		next.ServeHTTP(rbw, r)

		if rbw.status >= 400 {
			errMessage := fmt.Sprintf("HTTP %d Error", rbw.status)
			responseBody := rbw.body.String()
			
			payload := map[string]any{
				"url":      r.URL.String(),
				"method":   r.Method,
				"ip":       r.RemoteAddr,
				"status":   rbw.status,
				"response": responseBody,
			}
			
			err := fmt.Errorf(errMessage)
			traceforge.CaptureException(err, map[string]string{
				"framework": "nethttp", 
				"type": "http_error",
				"status_code": fmt.Sprintf("%d", rbw.status),
			}, payload)
		}
	})
}
