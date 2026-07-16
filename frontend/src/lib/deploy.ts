const CONTRACT_ADDRESS_KEY = 'guestbook-contract-address';
const WALLET_SEED_KEY = 'midnight-guestbook-seed';

// The wallet's getConfiguration() can return undefined/empty URIs if the user
// hasn't finished setting up their network in Lace. Passing those into the
// providers throws an opaque "Failed to construct 'URL': Invalid URL". Validate
// up front so the error names the offending field instead.
// The compiled Contract constructor requires a witnesses object whose
// authorSecretKey is a function returning [nextPrivateState, secretKey].
// CompiledContract.make() does NOT attach witnesses, so we must associate them
// with withWitnesses() before deploying — otherwise the constructor receives
// `undefined` and throws "first (witnesses) argument ... is not an object".
const guestbookWitnesses = {
  authorSecretKey(
    context: { privateState: { authorSecretKey: Uint8Array } },
  ): [{ authorSecretKey: Uint8Array }, Uint8Array] {
    return [context.privateState, context.privateState.authorSecretKey];
  },
};

function assertValidUri(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Wallet returned no ${field}. Open Lace > network settings and make sure the indexer, node, and proof server URIs are configured for the preview network.`
    );
  }
  try {
    new URL(value);
  } catch {
    throw new Error(`Wallet returned an invalid ${field}: "${value}"`);
  }
  return value;
}

// JSON can't round-trip Uint8Array (private states and signing keys hold them),
// so tag them on the way out and rebuild them on the way in.
function jsonReplacer(_key: string, value: any) {
  if (value instanceof Uint8Array) {
    return { __u8: Array.from(value) };
  }
  return value;
}

function jsonReviver(_key: string, value: any) {
  if (value && typeof value === 'object' && Array.isArray(value.__u8)) {
    return new Uint8Array(value.__u8);
  }
  return value;
}

// A localStorage-backed private state provider. The SDK stores the initial
// private state during deploy/find and reads it back when executing a call
// (see midnight-js-contracts: setOrGetInitialPrivateState -> get). A no-op stub
// makes get() return null, which throws "No private state found". This persists
// private states and signing keys so calls succeed and survive page reloads.
function createLocalStoragePrivateStateProvider() {
  const PS_PREFIX = 'guestbook-ps:';
  const SK_PREFIX = 'guestbook-sk:';
  const ADDR_KEY = 'guestbook-ps-address';

  const read = (key: string) => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw, jsonReviver);
  };
  const write = (key: string, value: unknown) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value, jsonReplacer));
  };

  return {
    get: async (id: string) => read(PS_PREFIX + id),
    set: async (id: string, state: unknown) => {
      write(PS_PREFIX + id, state);
    },
    remove: async (id: string) => {
      if (typeof window !== 'undefined') localStorage.removeItem(PS_PREFIX + id);
    },
    clear: async () => {},
    setContractAddress: async (address: string) => {
      write(ADDR_KEY, address);
    },
    setSigningKey: async (address: string, key: unknown) => {
      write(SK_PREFIX + address, key);
    },
    getSigningKey: async (address: string) => read(SK_PREFIX + address),
    hasSigningKey: async (address: string) =>
      typeof window !== 'undefined' && localStorage.getItem(SK_PREFIX + address) != null,
    deleteSigningKey: async (address: string) => {
      if (typeof window !== 'undefined') localStorage.removeItem(SK_PREFIX + address);
    },
    removeSigningKey: async (address: string) => {
      if (typeof window !== 'undefined') localStorage.removeItem(SK_PREFIX + address);
    },
    clearSigningKeys: async () => {},
    exportPrivateStates: async () => ({}),
    importPrivateStates: async () => {},
    renameAccount: async () => {},
  } as any;
}

export function getStoredContractAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CONTRACT_ADDRESS_KEY);
}

export function setStoredContractAddress(address: string): void {
  localStorage.setItem(CONTRACT_ADDRESS_KEY, address);
}

// Posted messages live only in React state, so they vanish on refresh. Persist
// them per contract address so the list survives reloads. Keyed by address so
// switching contracts shows the right history.
const MESSAGES_KEY_PREFIX = 'guestbook-messages:';

export function getStoredMessages(contractAddress: string): any[] {
  if (typeof window === 'undefined' || !contractAddress) return [];
  const raw = localStorage.getItem(MESSAGES_KEY_PREFIX + contractAddress);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setStoredMessages(contractAddress: string, messages: any[]): void {
  if (typeof window === 'undefined' || !contractAddress) return;
  localStorage.setItem(MESSAGES_KEY_PREFIX + contractAddress, JSON.stringify(messages));
}

export function getOrCreateSeed(): string {
  if (typeof window === 'undefined') return '';
  let seed = localStorage.getItem(WALLET_SEED_KEY);
  if (!seed) {
    seed = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    localStorage.setItem(WALLET_SEED_KEY, seed);
  }
  return seed;
}

// Derive the 32-byte author secret key from the wallet seed. This is the value
// fed into the contract's authorSecretKey witness, so deploy, postMessage, and
// the displayed commitment must all derive it identically.
export function deriveAuthorSecretKey(seed: string): Uint8Array {
  const seedBytes = new TextEncoder().encode(seed);
  const authorSecretKey = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    authorSecretKey[i] = seedBytes[i % seedBytes.length] ^ ((i * 13 + 7) & 0xff);
  }
  return authorSecretKey;
}

// Compute the real author commitment the contract writes on-chain, by running
// the derived secret key through the compiled contract's pureCircuits. This
// matches the `author` ledger value exactly (persistentHash with domain
// separation), rather than a look-alike placeholder.
export async function computeAuthorCommitment(seed: string): Promise<string> {
  const contractModule = await import('../contracts/guestbook/contract/index.js');
  const sk = deriveAuthorSecretKey(seed);
  const commitment: Uint8Array = contractModule.pureCircuits.authorCommitment(sk);
  return Array.from(commitment).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function deployGuestbook(walletAPI: any): Promise<string> {
  const config = await walletAPI.getConfiguration();
  console.log('Wallet config:', config);

  const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
  setNetworkId(config.networkId);

  const { deployContract } = await import('@midnight-ntwrk/midnight-js-contracts');
  const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
  const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
  const { FetchZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-fetch-zk-config-provider');
  const { CompiledContract } = await import('@midnight-ntwrk/compact-js');
  const { Transaction, Binding, Proof, SignatureEnabled } = await import('@midnight-ntwrk/midnight-js-protocol/ledger');
  const { toHex, fromHex } = await import('@midnight-ntwrk/midnight-js-protocol/compact-runtime');
  const contractModule = await import('../contracts/guestbook/contract/index.js');

  const compiledContract = CompiledContract.withWitnesses(
    CompiledContract.make('guestbook', contractModule.Contract),
    guestbookWitnesses,
  );

  const shieldedAddresses = await walletAPI.getShieldedAddresses();
  const indexerUri = assertValidUri(config.indexerUri, 'indexer URI');
  const indexerWsUri = assertValidUri(config.indexerWsUri, 'indexer WebSocket URI');
  const proofServerUri = assertValidUri(config.proverServerUri || 'http://127.0.0.1:6300', 'proof server URI');
  const zkConfigUrl = typeof window !== 'undefined' ? `${window.location.origin}/contracts/guestbook` : '/contracts/guestbook';
  const zkConfigProvider = new FetchZkConfigProvider(zkConfigUrl, fetch.bind(window));

  const walletProvider = {
    getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
    balanceTx: async (tx: any) => {
      // Wallet errors cross the extension boundary with an empty message, so
      // wrap them to surface something actionable. A failure here is usually
      // insufficient DUST to pay the transaction fee.
      try {
        const received = await walletAPI.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize('signature', 'proof', 'binding', fromHex(received.tx));
      } catch (e: any) {
        throw new Error(
          `Wallet could not balance the transaction: ${e?.message || e?.name || 'check that the wallet has DUST to pay fees'}`,
        );
      }
    },
  };

  const midnightProvider = {
    submitTx: async (tx: any) => {
      try {
        await walletAPI.submitTransaction(toHex(tx.serialize()));
      } catch (e: any) {
        throw new Error(`Wallet could not submit the transaction: ${e?.message || e?.name || 'submission rejected'}`);
      }
      return tx.identifiers?.()[0] || '';
    },
  };

  const seed = getOrCreateSeed();
  const authorSecretKey = deriveAuthorSecretKey(seed);

  const providers = {
    privateStateProvider: createLocalStoragePrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(indexerUri, indexerWsUri),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proofServerUri, zkConfigProvider),
    walletProvider,
    midnightProvider,
  };

  const deployed = await deployContract(providers as any, {
    compiledContract: compiledContract as any,
    args: [],
    privateStateId: 'guestbook-private-state',
    initialPrivateState: { authorSecretKey },
  });

  const contractAddress = deployed.deployTxData.public.contractAddress;
  setStoredContractAddress(contractAddress);
  return contractAddress;
}

export async function postMessage(
  walletAPI: any,
  contractAddress: string,
  message: string,
): Promise<{ txHash: string; contractAddress: string }> {
  const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
  const config = await walletAPI.getConfiguration();
  setNetworkId(config.networkId);

  const { findDeployedContract } = await import('@midnight-ntwrk/midnight-js-contracts');
  const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider');
  const { indexerPublicDataProvider } = await import('@midnight-ntwrk/midnight-js-indexer-public-data-provider');
  const { FetchZkConfigProvider } = await import('@midnight-ntwrk/midnight-js-fetch-zk-config-provider');
  const { CompiledContract } = await import('@midnight-ntwrk/compact-js');
  const { Transaction, Binding, Proof, SignatureEnabled } = await import('@midnight-ntwrk/midnight-js-protocol/ledger');
  const { toHex, fromHex } = await import('@midnight-ntwrk/midnight-js-protocol/compact-runtime');
  const contractModule = await import('../contracts/guestbook/contract/index.js');

  const compiledContract = CompiledContract.withWitnesses(
    CompiledContract.make('guestbook', contractModule.Contract),
    guestbookWitnesses,
  );
  const shieldedAddresses = await walletAPI.getShieldedAddresses();
  const indexerUri = assertValidUri(config.indexerUri, 'indexer URI');
  const indexerWsUri = assertValidUri(config.indexerWsUri, 'indexer WebSocket URI');
  const proofServerUri = assertValidUri(config.proverServerUri || 'http://127.0.0.1:6300', 'proof server URI');
  const zkConfigUrl = typeof window !== 'undefined' ? `${window.location.origin}/contracts/guestbook` : '/contracts/guestbook';
  const zkConfigProvider = new FetchZkConfigProvider(zkConfigUrl, fetch.bind(window));

  const walletProvider = {
    getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
    balanceTx: async (tx: any) => {
      // Wallet errors cross the extension boundary with an empty message, so
      // wrap them to surface something actionable. A failure here is usually
      // insufficient DUST to pay the transaction fee.
      try {
        const received = await walletAPI.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize('signature', 'proof', 'binding', fromHex(received.tx));
      } catch (e: any) {
        throw new Error(
          `Wallet could not balance the transaction: ${e?.message || e?.name || 'check that the wallet has DUST to pay fees'}`,
        );
      }
    },
  };

  const midnightProvider = {
    submitTx: async (tx: any) => {
      try {
        await walletAPI.submitTransaction(toHex(tx.serialize()));
      } catch (e: any) {
        throw new Error(`Wallet could not submit the transaction: ${e?.message || e?.name || 'submission rejected'}`);
      }
      return tx.identifiers?.()[0] || '';
    },
  };

  const seed = getOrCreateSeed();
  const authorSecretKey = deriveAuthorSecretKey(seed);

  const providers = {
    privateStateProvider: createLocalStoragePrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(indexerUri, indexerWsUri),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proofServerUri, zkConfigProvider),
    walletProvider,
    midnightProvider,
  };

  const contract = await findDeployedContract(providers as any, {
    compiledContract: compiledContract as any,
    contractAddress,
    privateStateId: 'guestbook-private-state',
    initialPrivateState: { authorSecretKey },
  });

  const result = await contract.callTx.storeMessage(message);
  // The explorer indexes transactions by their block-inclusion hash (txHash),
  // not the mempool identifier (txId). Linking with txId gives a 404.
  const pub = (result as any).public ?? {};
  const txHash = pub.txHash || pub.txId || '';

  return { txHash, contractAddress };
}
