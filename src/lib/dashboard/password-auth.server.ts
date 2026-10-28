import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { getDashboardPasswordUser, setDashboardPasswordHash } from "./synced-orders.server";
import { createDashboardSessionCookie, getDashboardSession } from "./google-auth.server";

const ALLOWED_DOMAIN = "miraclecloud-technology.com";
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function isAllowedEmail(value: string) {
  return value.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, 64, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [algorithm, saltHex, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltHex || !expectedHex || !/^[a-f\d]{32}$/i.test(saltHex) || !/^[a-f\d]{128}$/i.test(expectedHex)) return false;
  const actual = await deriveKey(password, Buffer.from(saltHex, "hex"));
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function passwordLoginResponse(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    if (typeof body.email !== "string" || typeof body.password !== "string") {
      return Response.json({ error: "Enter your company email and dashboard password." }, { status: 400 });
    }
    const email = body.email.trim().toLowerCase();
    if (!isAllowedEmail(email) || body.password.length > PASSWORD_MAX_LENGTH) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }
    const user = await getDashboardPasswordUser(email);
    if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
      return Response.json({ error: "Invalid email or password. First-time users must set a dashboard password using Google sign-in." }, { status: 401 });
    }
    const headers = new Headers({ "cache-control": "no-store" });
    headers.append("set-cookie", createDashboardSessionCookie(request, {
      sub: user.googleSub,
      email,
      name: user.displayName,
    }));
    return Response.json({ user: { email, name: user.displayName, role: "Company Member" } }, { headers });
  } catch (error) {
    console.error("Dashboard password login failed", error);
    return Response.json({ error: "Password login is temporarily unavailable." }, { status: 500 });
  }
}

export async function setDashboardPasswordResponse(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const session = getDashboardSession(request);
  if (!session) return Response.json({ error: "Sign in with Google before setting a dashboard password." }, { status: 401 });
  try {
    const body = await request.json() as { password?: unknown; confirmPassword?: unknown };
    if (typeof body.password !== "string" || typeof body.confirmPassword !== "string") {
      return Response.json({ error: "Enter and confirm your new dashboard password." }, { status: 400 });
    }
    if (body.password.length < PASSWORD_MIN_LENGTH || body.password.length > PASSWORD_MAX_LENGTH) {
      return Response.json({ error: `Use a password between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.` }, { status: 400 });
    }
    if (body.password !== body.confirmPassword) return Response.json({ error: "The passwords do not match." }, { status: 400 });
    const updated = await setDashboardPasswordHash(session.email, await hashPassword(body.password));
    if (!updated) return Response.json({ error: "Your company account was not found. Sign in with Google again." }, { status: 404 });
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Dashboard password setup failed", error);
    return Response.json({ error: "Could not save the dashboard password." }, { status: 500 });
  }
}
