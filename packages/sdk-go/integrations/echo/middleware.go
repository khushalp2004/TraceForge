package tfecho

import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/labstack/echo/v4"
	"github.com/khushalp2004/TraceForge/packages/sdk-go"
)

// TraceForge is an Echo middleware that recovers from panics and reports them to TraceForge.
func TraceForge() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			defer func() {
				if err := recover(); err != nil {
					stack := debug.Stack()
					
					payload := map[string]any{
						"url":    c.Request().URL.String(),
						"method": c.Request().Method,
						"ip":     c.RealIP(),
					}
					
					traceforge.CapturePanic(err, stack, map[string]string{"framework": "echo"}, payload)
					
					c.JSON(http.StatusInternalServerError, map[string]string{
						"error": "Internal Server Error",
					})
				}
			}()
			return next(c)
		}
	}
}
