import { createPublicKey, createHmac, createVerify, randomBytes, timingSafeEqual } from "node:crypto";
import { recordDashboardGoogleUser } from "./synced-orders.server";

const SESSION_COOKIE = "ecommerce360_session";
const STATE_COOKIE = "ecommerce360_google_state";
const ALLOWED_DOMAIN = "miraclecloud-technology.com";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const STATE_MAX_AGE_SECONDS = 10 * 60;

export interface DashboardUser {
  email: string;
  name: string;
  role: string;
}

interface SessionPayload extends DashboardUser {
  sub: string;
  exp: number;
}

interface GoogleJwk extends JsonWebKey {
  kid: string;
  alg?: string;
  use?: string;
}

interface GoogleClaims {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

let googleKeysCache: { expiresAt: number; keys: GoogleJwk[] } | undefined;

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}

function cookieOptions(request: Request, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearCookieOptions(request: Request) {
  return cookieOptions(request, 0);
}

function sessionSecret() {
  const secret = process.env["AUTH_SESSION_SECRET"];
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("AUTH_SESSION_SECRET must contain at least 32 bytes of random data.");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function equalSignatures(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isAllowedCompanyEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email.endsWith(`@${ALLOWED_DOMAIN}`);
}

export function getDashboardSession(request: Request): DashboardUser | null {
  try {
    const value = cookieValue(request, SESSION_COOKIE);
    if (!value) return null;
    const [encodedPayload, suppliedSignature] = value.split(".");
    if (!encodedPayload || !suppliedSignature || !equalSignatures(sign(encodedPayload), suppliedSignature)) return null;
    const session = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    if (session.exp <= Math.floor(Date.now() / 1000) || !session.sub || !isAllowedCompanyEmail(session.email)) return null;
    return { email: session.email, name: session.name, role: session.role };
  } catch {
    return null;
  }
}

export function createDashboardSessionCookie(request: Request, identity: { sub: string; email: string; name: string }) {
  const session: SessionPayload = {
    ...identity,
    email: identity.email.trim().toLowerCase(),
    role: "Company Member",
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  if (!isAllowedCompanyEmail(session.email)) throw new Error("Only company-domain accounts can sign in.");
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${SESSION_COOKIE}=${payload}.${sign(payload)}; ${cookieOptions(request, SESSION_MAX_AGE_SECONDS)}`;
}

async function loadGoogleKeys() {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load Google's signing keys.");
  const payload = await response.json() as { keys?: GoogleJwk[] };
  if (!payload.keys?.length) throw new Error("Google returned no signing keys.");
  const maxAge = Number(/max-age=(\d+)/i.exec(response.headers.get("cache-control") ?? "")?.[1] ?? 3600);
  googleKeysCache = { keys: payload.keys, expiresAt: Date.now() + maxAge * 1000 };
}

async function googlePublicKey(kid: string) {
  if (!googleKeysCache || googleKeysCache.expiresAt <= Date.now()) await loadGoogleKeys();
  let key = googleKeysCache?.keys.find((candidate) => candidate.kid === kid && candidate.use === "sig");
  if (!key) {
    await loadGoogleKeys();
    key = googleKeysCache?.keys.find((candidate) => candidate.kid === kid && candidate.use === "sig");
  }
  if (!key) throw new Error("Google signing key was not found.");
  return createPublicKey({ key, format: "jwk" });
}

async function verifyGoogleIdToken(idToken: string): Promise<{ sub: string; email: string; name: string }> {
  const [headerPart, payloadPart, signaturePart] = idToken.split(".");
  if (!headerPart || !payloadPart || !signaturePart) throw new Error("Google returned an invalid identity token.");
  const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8")) as { alg?: string; kid?: string };
  if (header.alg !== "RS256" || !header.kid) throw new Error("Google returned an unsupported identity token.");
  const key = await googlePublicKey(header.kid);
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerPart}.${payloadPart}`);
  verifier.end();
  if (!verifier.verify(key, Buffer.from(signaturePart, "base64url"))) throw new Error("Google identity token signature is invalid.");

  const claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as GoogleClaims;
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = Math.floor(Date.now() / 1000);
  if (!clientId || !audiences.includes(clientId)) throw new Error("Google identity token was issued for a different app.");
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") throw new Error("Google identity token issuer is invalid.");
  if (!claims.exp || claims.exp <= now || !claims.iat || claims.iat > now + 60) throw new Error("Google identity token has expired or is not yet valid.");
  if (!claims.sub || !claims.email || claims.email_verified !== true) throw new Error("Use a verified Google account to sign in.");
  if (!isAllowedCompanyEmail(claims.email)) throw new Error(`Sign in with a verified @${ALLOWED_DOMAIN} Google account.`);
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), name: claims.name?.trim() || claims.email.split("@")[0] || "User" };
}

function loginFailure(request: Request, reason: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("authError", reason);
  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), "set-cookie": `${STATE_COOKIE}=; ${clearCookieOptions(request)}` },
  });
}

export function beginGoogleLogin(request: Request) {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const redirectUri = process.env["GOOGLE_REDIRECT_URI"];
  if (!clientId || !process.env["GOOGLE_CLIENT_SECRET"] || !redirectUri) return loginFailure(request, "setup");

  try {
    sessionSecret();
  } catch {
    return loginFailure(request, "setup");
  }

  const state = randomBytes(32).toString("base64url");
  const intent = new URL(request.url).searchParams.get("intent") === "set-password" ? "set-password" : "login";
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  return new Response(null, {
    status: 302,
    headers: {
      location: url.toString(),
      "set-cookie": `${STATE_COOKIE}=${state}.${intent}; ${cookieOptions(request, STATE_MAX_AGE_SECONDS)}`,
    },
  });
}

export async function completeGoogleLogin(request: Request) {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  const storedStateValue = cookieValue(request, STATE_COOKIE);
  const [storedState, intent = "login"] = storedStateValue?.split(".") ?? [];
  if (!state || !storedState || !equalSignatures(state, storedState)) return loginFailure(request, "failed");
  if (requestUrl.searchParams.has("error")) return loginFailure(request, "denied");

  const code = requestUrl.searchParams.get("code");
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  const redirectUri = process.env["GOOGLE_REDIRECT_URI"];
  if (!code || !clientId || !clientSecret || !redirectUri) return loginFailure(request, "setup");

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    const tokens = await response.json() as { id_token?: string };
    if (!response.ok || !tokens.id_token) return loginFailure(request, "failed");

    const identity = await verifyGoogleIdToken(tokens.id_token);
    await recordDashboardGoogleUser(identity);
    const destination = intent === "set-password" ? "/login?setupPassword=1" : "/";
    const headers = new Headers({ location: new URL(destination, request.url).toString() });
    headers.append("set-cookie", createDashboardSessionCookie(request, identity));
    headers.append("set-cookie", `${STATE_COOKIE}=; ${clearCookieOptions(request)}`);
    return new Response(null, { status: 302, headers });
  } catch (error) {
    if (error instanceof Error && error.message.includes(`@${ALLOWED_DOMAIN}`)) return loginFailure(request, "domain");
    console.error("Google sign-in failed", error);
    return loginFailure(request, "failed");
  }
}

export function getSessionResponse(request: Request) {
  const user = getDashboardSession(request);
  return Response.json(user ? { user } : { user: null }, {
    status: user ? 200 : 401,
    headers: { "cache-control": "no-store" },
  });
}

export function logoutResponse(request: Request) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "set-cookie": `${SESSION_COOKIE}=; ${clearCookieOptions(request)}`,
    },
  });
}
