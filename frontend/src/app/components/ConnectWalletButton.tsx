"use client";

import { useState, useCallback, useEffect } from "react";

interface WalletState {
  connected: boolean;
  address: string | null;
  walletAPI: unknown;
}

const WALLET_STORAGE_KEY = "midnight-guestbook-wallet";

export default function ConnectWalletButton({
  onWalletConnected,
}: {
  onWalletConnected?: (wallet: unknown) => void;
}) {
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    address: null,
    walletAPI: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore connection on mount
  useEffect(() => {
    const restore = async () => {
      const saved = localStorage.getItem(WALLET_STORAGE_KEY);
      if (saved !== "connected") return;

      try {
        const midnight = (window as any).midnight;
        if (!midnight) return;

        const walletIds = Object.keys(midnight);
        if (walletIds.length === 0) return;

        const wallet = midnight[walletIds[0]];
        const connectedApi = await wallet.connect("preview");
        const status = await connectedApi.getConnectionStatus();
        if (!status) {
          localStorage.removeItem(WALLET_STORAGE_KEY);
          return;
        }

        const addresses = await connectedApi.getShieldedAddresses();
        setWalletState({
          connected: true,
          address: addresses.shieldedAddress || addresses[0],
          walletAPI: connectedApi,
        });
        onWalletConnected?.(connectedApi);
      } catch {
        localStorage.removeItem(WALLET_STORAGE_KEY);
      }
    };
    restore();
  }, [onWalletConnected]);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const midnight = (window as any).midnight;
      if (!midnight) {
        throw new Error("Install Midnight Lace wallet extension.");
      }

      const walletIds = Object.keys(midnight);
      if (walletIds.length === 0) {
        throw new Error("No wallets found.");
      }

      const wallet = midnight[walletIds[0]];
      const connectedApi = await wallet.connect("preview");
      const addresses = await connectedApi.getShieldedAddresses();

      setWalletState({
        connected: true,
        address: addresses.shieldedAddress || addresses[0],
        walletAPI: connectedApi,
      });
      localStorage.setItem(WALLET_STORAGE_KEY, "connected");
      onWalletConnected?.(connectedApi);
    } catch (err: any) {
      setError(err.message || "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  }, [onWalletConnected]);

  const handleDisconnect = useCallback(() => {
    setWalletState({ connected: false, address: null, walletAPI: null });
    localStorage.removeItem(WALLET_STORAGE_KEY);
    onWalletConnected?.(null);
  }, [onWalletConnected]);

  return (
    <nav className="flex items-center justify-between w-full p-4 border-b-4 border-black bg-white">
      <div className="text-2xl font-black uppercase tracking-tight">Anonymous Guestbook</div>
      <div className="flex flex-col items-end gap-2">
        {walletState.connected && walletState.address && (
          <div className="text-xs font-mono bg-gray-100 px-2 py-1 border border-black">
            {walletState.address.slice(0, 16)}...{walletState.address.slice(-10)}
          </div>
        )}
        {error && <div className="text-xs text-red-600 font-bold">{error}</div>}
        <button
          type="button"
          onClick={walletState.connected ? handleDisconnect : handleConnect}
          disabled={isConnecting}
          className="px-6 py-3 font-bold uppercase border-4 border-black bg-black text-white hover:bg-white hover:text-black transition-colors disabled:opacity-50"
        >
          {isConnecting ? "Connecting..." : walletState.connected ? "Disconnect" : "Connect Lace"}
        </button>
      </div>
    </nav>
  );
}
