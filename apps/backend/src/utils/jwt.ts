import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET environment variable must be set");
}

export type AuthTokenPayload = {
  sub: string;
  email: string;
};

export const signToken = (payload: AuthTokenPayload) => {
  // 24h access tokens; rotation can be handled at the client level.
  return jwt.sign(payload, jwtSecret, { expiresIn: "24h" });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, jwtSecret) as AuthTokenPayload;
};

