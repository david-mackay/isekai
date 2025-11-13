import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";

const SESSION_COOKIE_NAME = "isekai_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const jwtSecret = process.env.JWT_SECRET as string;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is not set");
}

type SessionPayload = {
  sub: string;
  walletAddress: string;
  exp: number;
};

export interface AuthenticatedUser {
  id: string;
  walletAddress: string;
}

export function createSessionToken(userId: string, walletAddress: string) {
  return jwt.sign({ sub: userId, walletAddress }, jwtSecret, {
    expiresIn: SESSION_TTL_SECONDS,
  });
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    path: "/",
  });
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === "string" &&
    typeof payload.walletAddress === "string" &&
    typeof payload.exp === "number"
  );
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (!isSessionPayload(decoded)) return null;
    const payload = decoded;
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });
    if (!user) return null;
    return { id: user.id, walletAddress: user.walletAddress };
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}
