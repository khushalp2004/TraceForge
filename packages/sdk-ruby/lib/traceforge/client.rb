require 'net/http'
require 'json'
require 'uri'
require 'thread'

module TraceForge
  class Client
    def self.capture_exception(exception, metadata = {})
      return unless TraceForge.configuration.api_key

      payload = {
        type: metadata[:type] || 'exception',
        message: exception.message,
        stackTrace: exception.backtrace&.join("\n") || '',
        file: exception.backtrace&.first&.split(':')&.first || '',
        line: exception.backtrace&.first&.split(':')&.fetch(1, 0)&.to_i || 0,
        metadata: {
          framework: 'ruby-on-rails',
          language: 'ruby'
        }.merge(metadata)
      }

      send_payload(payload)
    end

    private

    def self.send_payload(payload)
      Thread.new do
        begin
          uri = URI.parse(TraceForge.configuration.ingest_url)
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = (uri.scheme == 'https')
          http.open_timeout = 1
          http.read_timeout = 1

          request = Net::HTTP::Post.new(uri.request_uri)
          request['X-Traceforge-Key'] = TraceForge.configuration.api_key
          request['Content-Type'] = 'application/json'
          request.body = payload.to_json

          http.request(request)
        rescue StandardError => e
          # Fail silently to not crash the host application
        end
      end
    end
  end
end
