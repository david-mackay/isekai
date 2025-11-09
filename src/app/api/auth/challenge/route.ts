import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { authNonces } from "@/server/db/schema";

const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function buildMessage(domain: string, walletAddress: string, nonce: string) {
  const issuedAt = new Date().toISOString();
  return `Sign in to Isekai\nDomain: ${domain}\nWallet: ${walletAddress}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = (await req.json()) as {
      walletAddress?: string;
    };

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 }
      );
    }

    const nonce = crypto.randomUUID();
    const domain = new URL(req.url).hostname;
    const message = buildMessage(domain, walletAddress, nonce);
    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_MS);

    await db.transaction(async (tx) => {
      await tx
        .delete(authNonces)
        .where(eq(authNonces.walletAddress, walletAddress));
      await tx.insert(authNonces).values({
        walletAddress,
        nonce,
        message,
        expiresAt,
      });
    });

    return NextResponse.json({ nonce, message, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error("/api/auth/challenge error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export type AuthChallengeResponse = {
  nonce: string;
  message: string;
  expiresAt: string;
};
