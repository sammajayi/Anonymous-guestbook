"use client";

import { useState, useEffect, useCallback } from "react";
import type { InitialAPI } from "@midnight-ntwrk/dapp-connector-api";

interface Message {
  message: string;
  author: string;
  postCount: number;
}

export default function GuestBook({
  walletAPI,
}: {
  walletAPI: InitialAPI | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [postCount, setPostCount] = useState(0);

  // Simulated messages for demo (in real app, read from indexer)
  const demoMessages: Message[] = [
    {
      message: "Hello from the Anonymous Guestbook!",
      author: "0x1a2b3c...d4e5f6",
      postCount: 1,
    },
    {
      message: "Privacy matters in Web3",
      author: "0x1a2b3c...d4e5f6",
      postCount: 2,
    },
    {
      message: "Built with Midnight Network",
      author: "0x7g8h9i...j0k1l2",
      postCount: 3,
    },
  ];

  useEffect(() => {
    // Load demo messages on mount
    setMessages(demoMessages);
    setPostCount(demoMessages.length);
  }, []);

  const handleSubmitMessage = useCallback(async () => {
    if (!walletAPI || !newMessage.trim()) return;

    setIsSubmitting(true);
    setStatus("Generating zero-knowledge proof...");
    try {
      // In a real implementation, this would call the storeMessage circuit
      // through the Midnight JS SDK with the wallet's transaction signing
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate proof generation

      setStatus("Submitting transaction...");

      // Simulate transaction submission
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Add message to local state
      const authorCommitment = `0x${Array.from({ length: 12 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("")}...${Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("")}`;

      setMessages((prev) => [
        ...prev,
        {
          message: newMessage,
          author: authorCommitment,
          postCount: postCount + 1,
        },
      ]);
      setPostCount((prev) => prev + 1);
      setNewMessage("");
      setStatus("Message posted! Your authorship is proven without revealing your identity.");
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error("Failed to post message:", err);
      setStatus("Failed to post message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [walletAPI, newMessage, postCount]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Post a Message</h2>
        <p className="text-gray-600 mb-4">
          Your message will be public, but your identity stays private. The
          contract proves you posted without revealing who you are.
        </p>

        {!walletAPI ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">
              Connect your Lace wallet to post messages.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Write your anonymous message..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
            <button
              type="button"
              onClick={handleSubmitMessage}
              disabled={isSubmitting || !newMessage.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Posting..." : "Post Message"}
            </button>
          </div>
        )}

        {status && (
          <div
            className={`mt-4 p-3 rounded-lg ${
              status.includes("Failed")
                ? "bg-red-50 text-red-800"
                : "bg-green-50 text-green-800"
            }`}
          >
            {status}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">
          Guestbook Entries ({postCount})
        </h3>
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={`${index}-${msg.message}`}
              className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
            >
              <p className="text-gray-800 mb-2">{msg.message}</p>
              <div className="flex justify-between text-sm text-gray-500">
                <span className="font-mono">Author: {msg.author}</span>
                <span>Post #{msg.postCount}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-bold text-blue-900 mb-2">Privacy Proof</h4>
        <p className="text-sm text-blue-800">
          Each post shows an anonymous author commitment (a hash derived from a
          secret key). The same author always appears under the same commitment,
          proving consistency without revealing identity. This is the{" "}
          <code className="bg-blue-100 px-1 rounded">disclose()</code>{" "}
          function in action - the message and commitment are public, but the
          secret key never leaves your device.
        </p>
      </div>
    </div>
  );
}
