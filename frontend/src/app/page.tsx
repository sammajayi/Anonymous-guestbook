"use client";

import { useState } from "react";
import ConnectWalletButton from "./components/ConnectWalletButton";
import GuestBook from "./components/GuestBook";

export default function Home() {
  const [walletAPI, setWalletAPI] = useState<unknown>(null);

  return (
    <div className="min-h-screen bg-white text-black">
      <ConnectWalletButton onWalletConnected={setWalletAPI} />
      <main className="py-8">
        <GuestBook walletAPI={walletAPI} />
      </main>
    </div>
  );
}
