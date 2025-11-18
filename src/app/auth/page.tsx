"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useWalletAuth } from "@/hooks/useWalletAuth";

export default function AuthPage() {
  const router = useRouter();
  const walletAuth = useWalletAuth();
  const { open } = useAppKit();
  const { isConnected } = useAppKitAccount();

  useEffect(() => {
    if (walletAuth.status === "authenticated") {
      router.replace("/stories");
    }
  }, [walletAuth.status, router]);

  const isLoading =
    walletAuth.status === "checking" || walletAuth.status === "authenticating";

  const handleSignIn = () => {
    if (!isConnected) {
      open();
    } else if (walletAuth.status === "unauthenticated") {
      walletAuth.authenticate();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-gray-700 bg-gray-900/60 p-8 rounded-lg space-y-6 text-center">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-left">Welcome back</h1>
          <ThemeSwitcher />
        </div>

        <p className="text-sm text-gray-400 text-left">
          Connect your Solana wallet to resume your adventures. Once signed in,
          we'll drop you straight into your story list.
        </p>

        {walletAuth.error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200 text-left">
            {walletAuth.error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
