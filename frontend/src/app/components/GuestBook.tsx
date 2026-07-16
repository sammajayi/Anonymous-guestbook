"use client";

import { useState, useCallback, useEffect } from "react";
import {
  getStoredContractAddress,
  setStoredContractAddress,
  getCanonicalContractAddress,
  getOrCreateSeed,
  deployGuestbook,
  postMessage,
  computeAuthorCommitment,
  readGuestbook,
  type FeedEntry,
} from "../../lib/deploy";

export default function GuestBook({
  walletAPI,
}: {
  walletAPI: any;
}) {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [myCommitment, setMyCommitment] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [contractAddress, setContractAddressState] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  // The canonical address (from NEXT_PUBLIC_GUESTBOOK_ADDRESS) makes this a
  // single shared guestbook: everyone reads and writes the same contract, and
  // the deploy UI is hidden. Without it, fall back to the deploy/enter-address
  // flow so the contract can be deployed from the frontend.
  const canonicalAddress = getCanonicalContractAddress();

  // Load the shared feed from chain for a given contract. Works without a
  // connected wallet — reads go through the public indexer.
  const loadFeed = useCallback(async (address: string) => {
    setIsLoadingFeed(true);
    try {
      const feed = await readGuestbook(address);
      setEntries(feed);
    } catch (err: any) {
      console.error("Failed to load feed:", err);
      setStatus(`Could not load messages: ${err?.message || "unknown error"}`);
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  // On mount, resolve which contract to use and load its feed from chain.
  useEffect(() => {
    const address = canonicalAddress || getStoredContractAddress();
    if (address) {
      setContractAddressState(address);
      loadFeed(address);
    }
  }, [canonicalAddress, loadFeed]);

  // Derive the viewer's own author commitment so they can spot their own posts.
  useEffect(() => {
    (async () => {
      const seed = getOrCreateSeed();
      if (!seed) return;
      try {
        setMyCommitment(await computeAuthorCommitment(seed));
      } catch {
        /* non-fatal — just won't highlight own posts */
      }
    })();
  }, []);

  const handleDeploy = useCallback(async () => {
    if (!walletAPI) return;

    setIsDeploying(true);
    setStatus("Deploying contract to preview network...");
    try {
      const address = await deployGuestbook(walletAPI);
      setContractAddressState(address);
      setStatus(`Contract deployed! Set NEXT_PUBLIC_GUESTBOOK_ADDRESS=${address} in Vercel to make it the shared guestbook.`);
      await loadFeed(address);
    } catch (err: any) {
      console.error("Deploy failed:", err);
      const detail = err?.message || String(err);
      setStatus(`Deployment failed: ${detail.slice(0, 300)}`);
    } finally {
      setIsDeploying(false);
    }
  }, [walletAPI, loadFeed]);

  const handleSetAddress = useCallback(() => {
    if (manualAddress.trim()) {
      const addr = manualAddress.trim();
      setStoredContractAddress(addr);
      setContractAddressState(addr);
      setShowManualInput(false);
      setStatus("Contract address set!");
      loadFeed(addr);
      setTimeout(() => setStatus(null), 3000);
    }
  }, [manualAddress, loadFeed]);

  const handlePostMessage = useCallback(async () => {
    if (!walletAPI || !newMessage.trim() || !contractAddress) return;

    setIsSubmitting(true);
    setStatus("Generating zero-knowledge proof...");
    try {
      setStatus("Submitting transaction...");
      await postMessage(walletAPI, contractAddress, newMessage);

      setNewMessage("");
      setStatus("Posted! Refreshing the guestbook...");
      // Re-read from chain so the new entry (and anyone else's) shows up.
      await loadFeed(contractAddress);
      setStatus("Posted! Your message is on-chain.");
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus(`Failed to post: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [walletAPI, newMessage, contractAddress, loadFeed]);

  const total = entries.length;

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
          // No canonical address configured yet: allow deploying from the
          // frontend or pointing at an existing contract.
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
            className={`mt-4 p-3 border-4 border-black font-bold uppercase text-sm break-words ${
              status.includes("Failed") || status.includes("failed") || status.includes("Could not")
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
          Messages ({total})
        </h3>
        {isLoadingFeed && total === 0 && (
          <p className="text-sm border-l-4 border-black pl-3">Loading the guestbook from chain...</p>
        )}
        {!isLoadingFeed && total === 0 && (
          <p className="text-sm border-l-4 border-black pl-3">
            No messages yet. Be the first to post.
          </p>
        )}
        <div className="space-y-4">
          {entries.map((entry, index) => {
            // entries are newest-first, so the first row is the highest number.
            const postNumber = total - index;
            const isMine = myCommitment != null && entry.author === myCommitment;
            return (
              <div
                key={`${entry.author}-${postNumber}`}
                className="p-4 border-4 border-black border-l-8 border-l-[#D4AF37] bg-white"
              >
                <p className="font-mono text-sm mb-4 whitespace-pre-wrap">
                  {entry.message}
                </p>
                <div className="flex flex-wrap gap-4 text-xs border-t-2 border-black pt-2">
                  <div>
                    <span className="font-bold uppercase">Author: </span>
                    <span className="font-mono bg-gray-100 px-1">
                      {entry.author.slice(0, 16)}...
                    </span>
                    {isMine && (
                      <span className="ml-2 font-bold uppercase bg-[#D4AF37] px-1">You</span>
                    )}
                  </div>
                  <div>
                    <span className="font-bold uppercase">Post: </span>
                    <span className="font-mono">#{postNumber}</span>
                  </div>
                </div>
              </div>
            );
          })}
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
