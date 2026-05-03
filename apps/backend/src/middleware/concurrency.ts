import { NextFunction, Request, Response } from "express";

type ConcurrencyOptions = {
  namespace: string;
  maxConcurrent: number;
  message: string;
};

const inflightRequests = new Map<string, number>();

export const limitConcurrentRequests =
  ({ namespace, maxConcurrent, message }: ConcurrencyOptions) =>
  (req: Request, res: Response, next: NextFunction) => {
    const current = inflightRequests.get(namespace) ?? 0;

    if (current >= maxConcurrent) {
      res.setHeader("Retry-After", "1");
      return res.status(429).json({ error: message });
    }

    inflightRequests.set(namespace, current + 1);

    let settled = false;
    const release = () => {
      if (settled) {
        return;
      }
      settled = true;
      const active = inflightRequests.get(namespace) ?? 0;
      if (active <= 1) {
        inflightRequests.delete(namespace);
        return;
      }
      inflightRequests.set(namespace, active - 1);
    };

    res.on("finish", release);
    res.on("close", release);
    return next();
  };
