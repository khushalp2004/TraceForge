module TraceForge
  class Middleware
    def initialize(app)
      @app = app
    end

    def call(env)
      begin
        @app.call(env)
      rescue Exception => exception
        TraceForge::Client.capture_exception(exception, {
          url: env['REQUEST_URI'],
          method: env['REQUEST_METHOD']
        })
        raise exception
      end
    end
  end
end
