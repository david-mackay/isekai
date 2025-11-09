"use client";

import { ReactNode } from "react";
import { createAppKit } from "@reown/appkit/react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import { solana, solanaDevnet } from "@reown/appkit/networks";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

interface AppKitProviderProps {
  children: ReactNode;
}

const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ??
  process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) {
  console.warn(
    "NEXT_PUBLIC_REOWN_PROJECT_ID is not set. Wallet auth may fail."
  );
}

const metadata = {
  name: "Isekai",
  description: "Collaborative storytelling with an AI Dungeon Master.",
  url: "https://isekai.app",
  icons: ["https://isekai.app/icon.png"],
};

const solanaAdapter = new SolanaAdapter({
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
});

createAppKit({
  adapters: [solanaAdapter],
  projectId: projectId ?? "",
  networks: [solana, solanaDevnet],
  defaultNetwork: solana,
  metadata,
  features: {
    email: false,
    socials: [],
  },
  allWallets: "SHOW",
});

export function AppKitProvider({ children }: AppKitProviderProps) {
  return <>{children}</>;
}
