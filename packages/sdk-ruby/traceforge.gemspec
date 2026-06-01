Gem::Specification.new do |spec|
  spec.name          = "traceforge"
  spec.version       = "1.0.0"
  spec.authors       = ["Khushal Patil"]
  spec.email         = ["khushal@example.com"]
  spec.summary       = "TraceForge Ruby SDK"
  spec.description   = "TraceForge SDK for Ruby to capture exceptions and messages asynchronously"
  spec.homepage      = "https://github.com/khushalp2004/TraceForge"
  spec.license       = "MIT"

  spec.files         = Dir["lib/**/*.rb"]
  spec.require_paths = ["lib"]

  spec.add_dependency "json"
end
