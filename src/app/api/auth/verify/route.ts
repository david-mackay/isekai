import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { authNonces, users } from "@/server/db/schema";
import {
  createSessionToken,
  setSessionCookie,
} from "@/server/auth/session";

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, signature, nonce } = (await req.json()) as {
      walletAddress?: string;
      signature?: string;
      nonce?: string;
    };

    if (!walletAddress || !signature || !nonce) {
      return NextResponse.json(
        { error: "Missing walletAddress, signature, or nonce" },
        { status: 400 }
      );
    }

    const challenge = await db.query.authNonces.findFirst({
      where: (fields, { and, eq: eqFn }) =>
        and(eqFn(fields.walletAddress, walletAddress), eqFn(fields.nonce, nonce)),
    });

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 400 });
    }

    if (challenge.expiresAt < new Date()) {
      await db.delete(authNonces).where(eq(authNonces.id, challenge.id));
      return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
    }

    try {
      const messageBytes = new TextEncoder().encode(challenge.message);
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = bs58.decode(walletAddress);
      const verified = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      );
      if (!verified) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } catch (error) {
      console.error("Signature verification failed", error);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.walletAddress, walletAddress),
    });

    const user =
      existingUser ??
      (await db
        .insert(users)
        .values({ walletAddress })
        .returning()
        .then((rows) => rows[0]));

    if (!user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const token = createSessionToken(user.id, user.walletAddress);
    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, walletAddress: user.walletAddress },
    });
    setSessionCookie(response, token);

    await db.delete(authNonces).where(eq(authNonces.id, challenge.id));

    return response;
  } catch (error) {
    console.error("/api/auth/verify error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export type AuthVerifyResponse = {
  ok: true;
  user: {
    id: string;
    walletAddress: string;
  };
};
