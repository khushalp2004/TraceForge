require 'traceforge/client'
require 'traceforge/middleware'
require 'traceforge/railtie' if defined?(Rails)

module TraceForge
  class << self
    def configure
      yield(configuration)
    end

    def configuration
      @configuration ||= Configuration.new
    end
  end

  class Configuration
    attr_accessor :api_key, :ingest_url

    def initialize
      @api_key = ENV['TRACEFORGE_API_KEY']
      @ingest_url = ENV['TRACEFORGE_INGEST_URL'] || 'http://localhost:3001/ingest'
    end
  end
end
