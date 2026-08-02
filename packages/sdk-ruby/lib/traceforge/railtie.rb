require 'traceforge/middleware'

module TraceForge
  class Railtie < Rails::Railtie
    initializer "traceforge.configure_rails_initialization" do |app|
      app.middleware.insert_after ActionDispatch::DebugExceptions, TraceForge::Middleware
    end
  end
end
