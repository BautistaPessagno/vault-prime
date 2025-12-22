import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const encoder = new TextEncoder();

function getJwtConfig() {
  const secret = process.env.JWT_SECRET;
  const issuer = process.env.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE;

  if (!secret || !issuer || !audience) {
    throw new Error("Missing JWT configuration.");
  }

  return {
    secret: encoder.encode(secret),
    issuer,
    audience,
  };
}

export async function signSessionToken(payload: JWTPayload) {
  const { secret, issuer, audience } = getJwtConfig();

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  const { secret, issuer, audience } = getJwtConfig();
  const { payload } = await jwtVerify(token, secret, {
    issuer,
    audience,
    clockTolerance: 15,
  });

  return payload;
}
