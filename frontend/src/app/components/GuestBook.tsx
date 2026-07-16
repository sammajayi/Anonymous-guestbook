"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getStoredContractAddress,
  setStoredContractAddress,
  getStoredMessages,
  setStoredMessages,
  getOrCreateSeed,
  deployGuestbook,
  postMessage,
  computeAuthorCommitment,
} from "../../lib/deploy";

interface PostedMessage {
  message: string;
  authorCommitment: string;
  txHash: string;
  postCount: number;
}

const EXPLORER_URL = "https://preview.midnightexplorer.com";

export default function GuestBook({
  walletAPI,
}: {
  walletAPI: any;
}) {
  const [messages, setMessages] = useState<PostedMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [contractAddress, setContractAddressState] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    const saved = getStoredContractAddress();
    if (saved) {
      setContractAddressState(saved);
      setMessages(getStoredMessages(saved));
    }
  }, []);

  // Persist messages per contract so they survive a page refresh.
  useEffect(() => {
    if (contractAddress) setStoredMessages(contractAddress, messages);
  }, [messages, contractAddress]);

  const handleDeploy = useCallback(async () => {
    if (!walletAPI) return;

    setIsDeploying(true);
    setStatus("Deploying contract to preview network...");
    try {
      const address = await deployGuestbook(walletAPI);
      setMessages(getStoredMessages(address));
      setContractAddressState(address);
      setStatus("Contract deployed successfully!");
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      console.error("Deploy failed:", err);
      const detail = err?.message || String(err);
      setStatus(`Deployment failed: ${detail.slice(0, 300)}`);
    } finally {
      setIsDeploying(false);
    }
  }, [walletAPI]);

  const handleSetAddress = useCallback(() => {
    if (manualAddress.trim()) {
      const addr = manualAddress.trim();
      setStoredContractAddress(addr);
      setMessages(getStoredMessages(addr));
      setContractAddressState(addr);
      setShowManualInput(false);
      setStatus("Contract address set!");
      setTimeout(() => setStatus(null), 3000);
    }
  }, [manualAddress]);

  const handlePostMessage = useCallback(async () => {
    if (!walletAPI || !newMessage.trim() || !contractAddress) return;

    setIsSubmitting(true);
    setStatus("Generating zero-knowledge proof...");
    try {
      const seed = getOrCreateSeed();
      const authorCommitment = computeAuthorCommitment(seed);

      setStatus("Submitting transaction...");
      const { txHash } = await postMessage(walletAPI, contractAddress, newMessage);

      setMessages((prev) => [
        ...prev,
        {
          message: newMessage,
          authorCommitment,
          txHash,
          postCount: messages.length + 1,
        },
      ]);
      setNewMessage("");
      setStatus("Posted! Transaction submitted.");
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus(`Failed to post: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [walletAPI, newMessage, messages.length, contractAddress]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-12 border-4 border-black p-6 bg-white">
        <h2 className="text-3xl font-black uppercase mb-2 inline-block border-b-4 border-[#D4AF37]">
          Post a Message
        </h2>
        <p className="text-sm mb-4 border-l-4 border-black pl-3">
          Your message is public. Your identity stays private. The contract
          proves you posted without revealing who you are.
        </p>

        {!walletAPI ? (
          <div className="p-4 border-4 border-black bg-gray-100 font-bold uppercase">
            Connect your Lace wallet to post.
          </div>
        ) : !contractAddress ? (
          <div className="space-y-4">
            <div className="p-4 border-4 border-black bg-yellow-100 font-bold uppercase">
              Deploy the guestbook contract or enter an existing address.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeploy}
                disabled={isDeploying}
                className="px-6 py-3 font-bold uppercase border-4 border-black bg-[#D4AF37] text-black hover:bg-black hover:text-[#D4AF37] transition-colors disabled:opacity-50"
              >
                {isDeploying ? "Deploying..." : "Deploy Contract"}
              </button>
              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="px-6 py-3 font-bold uppercase border-4 border-black bg-white text-black hover:bg-gray-100 transition-colors"
              >
                Enter Address
              </button>
            </div>
            {showManualInput && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Contract address (64 hex characters)"
                  className="w-full p-4 border-4 border-black font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={handleSetAddress}
                  className="px-6 py-3 font-bold uppercase border-4 border-black bg-black text-white hover:bg-white hover:text-black transition-colors"
                >
                  Set Address
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-2 border-2 border-black bg-gray-100 text-xs font-mono">
              Contract: {contractAddress.slice(0, 20)}...
            </div>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Write your anonymous message..."
              className="w-full p-4 border-4 border-black resize-none focus:outline-none focus:bg-gray-50 font-mono text-sm"
              rows={3}
            />
            <button
              type="button"
              onClick={handlePostMessage}
              disabled={isSubmitting || !newMessage.trim()}
              className="px-8 py-3 font-bold uppercase border-4 border-black bg-[#D4AF37] text-black hover:bg-black hover:text-[#D4AF37] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Posting..." : "Post Message"}
            </button>
          </div>
        )}

        {status && (
          <div
            className={`mt-4 p-3 border-4 border-black font-bold uppercase text-sm ${
              status.includes("Failed") || status.includes("failed")
                ? "bg-red-200"
                : "bg-green-200"
            }`}
          >
            {status}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-3xl font-black uppercase mb-6 inline-block border-b-4 border-[#D4AF37]">
          Messages ({messages.length})
        </h3>
        {messages.length === 0 && (
          <p className="text-sm border-l-4 border-black pl-3">
            No messages yet. Connect your wallet and post the first one.
          </p>
        )}
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className="p-4 border-4 border-black border-l-8 border-l-[#D4AF37] bg-white"
            >
              <p className="font-mono text-sm mb-4 whitespace-pre-wrap">
                {msg.message}
              </p>
              <div className="flex flex-wrap gap-4 text-xs border-t-2 border-black pt-2">
                <div>
                  <span className="font-bold uppercase">Author: </span>
                  <span className="font-mono bg-gray-100 px-1">
                    {msg.authorCommitment.slice(0, 16)}...
                  </span>
                </div>
                <div>
                  <span className="font-bold uppercase">Post: </span>
                  <span className="font-mono">#{msg.postCount}</span>
                </div>
                <div>
                  <span className="font-bold uppercase">Tx: </span>
                  <a
                    href={`${EXPLORER_URL}/transactions/${msg.txHash.startsWith("0x") ? msg.txHash : `0x${msg.txHash}`}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono underline hover:bg-gray-100 px-1"
                  >
                    {msg.txHash.slice(0, 16)}...
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 p-6 border-4 border-black border-t-8 border-t-[#D4AF37] bg-gray-100">
        <h4 className="font-black uppercase text-lg mb-3 inline-block border-b-4 border-[#D4AF37]">
          How Privacy Works
        </h4>
        <div className="space-y-3 text-sm">
          <div className="border-l-4 border-black pl-3">
            <strong className="uppercase">Message:</strong> Always public. Posted
            to the blockchain for everyone to read.
          </div>
          <div className="border-l-4 border-black pl-3">
            <strong className="uppercase">Author Commitment:</strong> A 32-byte
            hash derived from your secret key. Not your wallet address. Same key
            = same commitment, proving it&apos;s the same person without revealing
            who.
          </div>
          <div className="border-l-4 border-black pl-3">
            <strong className="uppercase">Secret Key:</strong> Never leaves your
            device. Used only to generate the ZK proof that you know the key
            behind the commitment.
          </div>
          <div className="border-l-4 border-black pl-3">
            <strong className="uppercase">ZK Proof:</strong> Cryptographic proof
            that the author knows the secret key, without disclosing the key
            itself.
          </div>
        </div>
      </div>
    </div>
  );
}
