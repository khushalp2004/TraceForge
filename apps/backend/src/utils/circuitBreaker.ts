import CircuitBreaker from "opossum";

const areCircuitBreakersDisabled = () => process.env.DISABLE_CIRCUIT_BREAKERS === "true";

type CircuitBreakerOptions = {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  name?: string;
};

const defaultOptions: CircuitBreakerOptions = {
  timeout: 30000, // 30 seconds
  errorThresholdPercentage: 50, // Open circuit when 50% of calls fail
  resetTimeout: 60000, // Try to reset after 60 seconds
  rollingCountTimeout: 10000, // Consider last 10 seconds
  rollingCountBuckets: 10, // 10 buckets for rolling window
};

const circuitBreakers = new Map<string, CircuitBreaker>();

export const getCircuitBreaker = (
  name: string,
  action: (...args: any[]) => Promise<any>,
  options: CircuitBreakerOptions = {}
): CircuitBreaker => {
  if (circuitBreakers.has(name)) {
    return circuitBreakers.get(name)!;
  }

  const mergedOptions = { ...defaultOptions, name, ...options };
  const breaker = new CircuitBreaker(action, mergedOptions);

  // Event listeners for monitoring
  breaker.on("open", () => {
    console.warn(`[Circuit Breaker] ${name} is OPEN - failing fast`);
  });

  breaker.on("halfOpen", () => {
    console.warn(`[Circuit Breaker] ${name} is HALF-OPEN - testing recovery`);
  });

  breaker.on("close", () => {
    console.log(`[Circuit Breaker] ${name} is CLOSED - normal operation`);
  });

  breaker.on("fallback", (error) => {
    console.error(`[Circuit Breaker] ${name} fallback triggered:`, error);
  });

  circuitBreakers.set(name, breaker);
  return breaker;
};

export const withCircuitBreaker = <T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  options?: CircuitBreakerOptions
): T => {
  if (areCircuitBreakersDisabled()) {
    return fn;
  }
  const breaker = getCircuitBreaker(name, fn, options);
  return breaker.fire.bind(breaker) as T;
};

export const getCircuitBreakerStats = (name: string) => {
  const breaker = circuitBreakers.get(name);
  if (!breaker) return null;

  return {
    name,
    state: breaker.opened ? "OPEN" : breaker.halfOpen ? "HALF_OPEN" : "CLOSED",
    stats: breaker.stats,
  };
};

export const getAllCircuitBreakerStats = () => {
  return Array.from(circuitBreakers.entries()).map(([name, breaker]) => ({
    name,
    state: breaker.opened ? "OPEN" : breaker.halfOpen ? "HALF_OPEN" : "CLOSED",
    stats: breaker.stats,
  }));
};
