import "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      email: string;
    };
    project?: {
      id: string;
      name: string;
      apiKey: string;
      userId: string;
    };
  }
}
