from traceforge.client import capture_exception

class TraceForgeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        # Capture the exception asynchronously
        payload = {
            "url": request.build_absolute_uri(),
            "method": request.method,
        }
        
        # We don't want to block the Django response
        capture_exception(exception, tags={"framework": "django"}, payload=payload)
        
        # Return None to let Django's default exception handling continue
        return None
