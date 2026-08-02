lib = File.expand_path("lib", __dir__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)

Gem::Specification.new do |spec|
  spec.name          = "traceforge"
  spec.version       = "1.0.8"
  spec.authors       = ["Khushal Patil"]
  spec.email         = ["patilkhushal54321@gmail.com"]

  spec.summary       = "TraceForge SDK for Ruby on Rails."
  spec.description   = "Zero-touch exception capturing for Ruby on Rails applications."
  spec.homepage      = "https://github.com/khushalp2004/TraceForge"
  spec.license       = "MIT"

  spec.files         = Dir["lib/**/*", "traceforge.gemspec"]
  spec.require_paths = ["lib"]

  spec.add_dependency "railties", ">= 5.0"
  spec.add_dependency "rack", ">= 2.0"
  spec.add_dependency "dotenv", ">= 2.0"
end
