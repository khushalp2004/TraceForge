package tfecho

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/labstack/echo/v4"
	"github.com/khushalp2004/TraceForge/packages/sdk-go"
)

type responseBodyWriter struct {
	http.ResponseWriter
	body *bytes.Buffer
}

func (w responseBodyWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func TraceForge() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			res := c.Response()
			w := &responseBodyWriter{body: &bytes.Buffer{}, ResponseWriter: res.Writer}
			res.Writer = w

			defer func() {
				if err := recover(); err != nil {
					stack := debug.Stack()
					payload := map[string]any{
						"url":    c.Request().URL.String(),
						"method": c.Request().Method,
						"ip":     c.RealIP(),
					}
					traceforge.CapturePanic(err, stack, map[string]string{"framework": "echo", "type": "panic"}, payload)
					c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Server Error"})
				}
			}()

			err := next(c)

			status := res.Status
			if err != nil {
				if he, ok := err.(*echo.HTTPError); ok {
					status = he.Code
				} else {
					status = http.StatusInternalServerError
				}
			}

			if status >= 400 {
				errMessage := fmt.Sprintf("HTTP %d Error", status)
				if err != nil {
					errMessage = err.Error()
				}
				
				responseBody := w.body.String()
				
				// Try to extract the actual error message from the JSON response
				var jsonBody map[string]interface{}
				if jsonErr := json.Unmarshal(w.body.Bytes(), &jsonBody); jsonErr == nil {
					if errMsg, ok := jsonBody["error"].(string); ok {
						errMessage = errMsg
					} else if msg, ok := jsonBody["message"].(string); ok {
						errMessage = msg
					}
				}
				
				payload := map[string]any{
					"url":      c.Request().URL.String(),
					"method":   c.Request().Method,
					"ip":       c.RealIP(),
					"status":   status,
					"response": responseBody,
				}
				
				captureErr := fmt.Errorf(errMessage)
				traceforge.CaptureException(captureErr, map[string]string{
					"framework": "echo", 
					"type": "http_error",
					"status_code": fmt.Sprintf("%d", status),
				}, payload)
			}
			
			return err
		}
	}
}
