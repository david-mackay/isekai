"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import bs58 from "bs58";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import type { Provider } from "@reown/appkit-adapter-solana/react";

type AuthStatus =
  | "checking"
  | "unauthenticated"
  | "authenticating"
  | "authenticated"
  | "error";

interface AuthUser {
  id: string;
  walletAddress: string;
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error?: string | null;
}

const initialState: AuthState = {
  status: "checking",
  user: null,
  error: null,
};

export function useWalletAuth() {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const [state, setState] = useState<AuthState>(initialState);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        setState({ status: "unauthenticated", user: null });
        return;
      }
      const data = (await res.json()) as {
        authenticated: boolean;
        user?: AuthUser;
      };
      if (data.authenticated && data.user) {
        setState({ status: "authenticated", user: data.user });
      } else {
        setState({ status: "unauthenticated", user: null });
      }
    } catch (error) {
      console.error("Failed to fetch auth session", error);
      setState({
        status: "error",
        user: null,
        error: "Failed to load session",
      });
    }
  }, []);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  const authenticate = useCallback(async () => {
    if (!isConnected || !address || !walletProvider) {
      setState({ status: "unauthenticated", user: null });
      return;
    }

    try {
      setState((prev) => ({ ...prev, status: "authenticating", error: null }));

      const challengeRes = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ walletAddress: address }),
      });

      if (!challengeRes.ok) {
        throw new Error("Failed to fetch authentication challenge");
      }

      const challenge = (await challengeRes.json()) as {
        nonce: string;
        message: string;
      };

      const messageBytes = new TextEncoder().encode(challenge.message);
      const signature = await walletProvider.signMessage(messageBytes);
      const signatureBase58 = bs58.encode(signature);

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          walletAddress: address,
          signature: signatureBase58,
          nonce: challenge.nonce,
        }),
      });

      if (!verifyRes.ok) {
        const errorBody = await verifyRes.json().catch(() => ({}));
        throw new Error(errorBody.error || "Verification failed");
      }

      const verifyData = (await verifyRes.json()) as {
        ok: boolean;
        user: AuthUser;
      };

      if (!verifyData.ok) {
        throw new Error("Verification failed");
      }

      setState({ status: "authenticated", user: verifyData.user });
    } catch (error) {
      console.error("Authentication failed", error);
      setState({
        status: "error",
        user: null,
        error: error instanceof Error ? error.message : "Authentication failed",
      });
    }
  }, [address, isConnected, walletProvider]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch (error) {
      console.error("Failed to logout", error);
    } finally {
      setState({ status: "unauthenticated", user: null });
    }
  }, []);

  useEffect(() => {
    if (!isConnected || !address) {
      setState((prev) =>
        prev.status === "checking"
          ? { status: "unauthenticated", user: null }
          : { ...prev, user: null }
      );
      return;
    }

    // Wait until initial session check completes to avoid redundant signatures
    if (state.status === "checking") {
      return;
    }

    if (
      state.status === "authenticated" &&
      state.user?.walletAddress === address
    ) {
      return;
    }

    if (state.status !== "unauthenticated") {
      return;
    }

    void authenticate();
  }, [
    isConnected,
    address,
    authenticate,
    state.status,
    state.user?.walletAddress,
  ]);

  return useMemo(
    () => ({
      status: state.status,
      user: state.user,
      error: state.error,
      isAuthenticated: state.status === "authenticated",
      authenticate,
      logout,
      refresh: fetchSession,
    }),
    [state, authenticate, logout, fetchSession]
  );
}
