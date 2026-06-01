require 'net/http'
require 'json'
require 'uri'

module TraceForge
  class << self
    attr_accessor :api_key, :environment, :endpoint

    def init(api_key:, environment: 'production', endpoint: 'https://traceforge.io/api/ingest')
      @api_key = api_key
      @environment = environment
      @endpoint = endpoint
    end

    def capture_exception(exception)
      payload = {
        message: exception.message,
        error: exception.class.name,
        stackTrace: exception.backtrace&.join("\n"),
        environment: @environment,
        level: 'error',
        timestamp: (Time.now.to_f * 1000).to_i,
        status: 500
      }
      send_to_traceforge(payload)
    end

    def capture_message(message, level: 'info')
      payload = {
        message: message,
        environment: @environment,
        level: level,
        timestamp: (Time.now.to_f * 1000).to_i
      }
      send_to_traceforge(payload)
    end

    private

    def send_to_traceforge(payload)
      return unless @api_key && @endpoint && !@api_key.empty?

      uri = URI(@endpoint)
      request = Net::HTTP::Post.new(uri)
      request['Content-Type'] = 'application/json'
      request['X-Traceforge-Key'] = @api_key
      request.body = payload.to_json

      # We use Thread to send it asynchronously to avoid blocking the web server
      Thread.new do
        begin
          Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https') do |http|
            http.request(request)
          end
        rescue => e
          warn "[TraceForge] Failed to send trace: #{e.message}"
        end
      end
    end
  end
end
