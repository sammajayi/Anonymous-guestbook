"use client";

import { useState } from "react";
import ConnectWalletButton from "./components/ConnectWalletButton";
import GuestBook from "./components/GuestBook";
import type { InitialAPI } from "@midnight-ntwrk/dapp-connector-api";

export default function Home() {
  const [walletAPI, setWalletAPI] = useState<InitialAPI | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <ConnectWalletButton onWalletConnected={setWalletAPI} />
      <main className="py-8">
        <GuestBook walletAPI={walletAPI} />
      </main>
    </div>
  );
}
