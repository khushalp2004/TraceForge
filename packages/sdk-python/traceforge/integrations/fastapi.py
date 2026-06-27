from traceforge.client import capture_exception

def init(app):
    """
    Registers a global exception handler for FastAPI/Starlette applications.
    """
    try:
        from fastapi import Request
        from starlette.responses import JSONResponse
        from starlette.exceptions import HTTPException
    except ImportError:
        return

    @app.exception_handler(Exception)
    async def traceforge_exception_handler(request: Request, exc: Exception):
        # Don't capture standard HTTPExceptions (like 404s) as crashes
        if isinstance(exc, HTTPException) and exc.status_code < 500:
            raise exc

        payload = {
            "url": str(request.url),
            "method": request.method,
        }
        
        capture_exception(exc, tags={"framework": "fastapi"}, payload=payload)
        
        # Re-raise the exception to let FastAPI handle it natively
        # Or return a 500 JSON response if we prefer to mask it
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error"}
        )
