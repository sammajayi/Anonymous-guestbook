"use client";

import { useState, useEffect, useCallback } from "react";
import "@midnight-ntwrk/dapp-connector-api";
import type { InitialAPI } from "@midnight-ntwrk/dapp-connector-api";

interface WalletState {
  connected: boolean;
  address: string | null;
  walletAPI: InitialAPI | null;
}

export default function ConnectWalletButton({
  onWalletConnected,
}: {
  onWalletConnected?: (wallet: InitialAPI | null) => void;
}) {
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    address: null,
    walletAPI: null,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const wallet: InitialAPI = await window.midnight!.mnLace;
      const connectedApi = await wallet.connect("preprod");
      const addresses = await connectedApi.getShieldedAddresses();
      const address = addresses.shieldedAddress;
      const connectionStatus = await connectedApi.getConnectionStatus();

      if (connectionStatus) {
        setWalletState({
          connected: true,
          address,
          walletAPI: connectedApi,
        });
        onWalletConnected?.(connectedApi);
      }
    } catch (err) {
      console.error("Failed to connect:", err);
      setError("Failed to connect wallet. Is Lace installed and unlocked?");
    } finally {
      setIsConnecting(false);
    }
  }, [onWalletConnected]);

  const handleDisconnect = useCallback(() => {
    setWalletState({
      connected: false,
      address: null,
      walletAPI: null,
    });
    onWalletConnected?.(null);
  }, [onWalletConnected]);

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const wallet: InitialAPI = await window.midnight?.mnLace;
        if (wallet) {
          const connectedApi = await wallet.connect("preprod");
          const connectionStatus = await connectedApi.getConnectionStatus();
          if (connectionStatus) {
            const addresses = await connectedApi.getShieldedAddresses();
            setWalletState({
              connected: true,
              address: addresses.shieldedAddress,
              walletAPI: connectedApi,
            });
            onWalletConnected?.(connectedApi);
          }
        }
      } catch {
        // Wallet not connected or not available
      }
    };
    checkConnection();
  }, [onWalletConnected]);

  return (
    <nav className="flex items-center justify-between w-full p-4 border-b border-gray-200">
      <div className="text-xl font-bold">Anonymous Guestbook</div>
      <div className="flex flex-col items-end gap-2">
        {walletState.connected && walletState.address && (
          <div className="text-sm text-gray-600 font-mono">
            {walletState.address.slice(0, 12)}...{walletState.address.slice(-8)}
          </div>
        )}
        {error && <div className="text-xs text-red-500">{error}</div>}
        <button
          type="button"
          onClick={walletState.connected ? handleDisconnect : handleConnect}
          disabled={isConnecting}
          className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {isConnecting
            ? "Connecting..."
            : walletState.connected
              ? "Disconnect"
              : "Connect Lace Wallet"}
        </button>
      </div>
    </nav>
  );
}
