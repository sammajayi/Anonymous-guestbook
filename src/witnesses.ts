/**
 * Witness implementations for the guestbook contract.
 *
 * A witness is the bridge between the Compact contract and the user's local
 * machine. The contract declares `witness authorSecretKey(): Bytes<32>` but
 * provides no body — the body lives here, in the TypeScript driver, and runs
 * only on the caller's machine. The returned secret feeds the zero-knowledge
 * proof but never appears in the public transaction or on-chain state.
 */
import * as crypto from 'node:crypto';

/**
 * Private state for the guestbook contract: a single 32-byte secret key that
 * identifies the author. It is stored locally by the private-state provider
 * and never leaves the machine.
 */
export interface GuestbookPrivateState {
  readonly authorSecretKey: Uint8Array;
}

/** Identifier under which the private state is stored by the provider. */
export const PRIVATE_STATE_ID = 'guestbook-private-state';

/**
 * Derive a stable 32-byte author secret from the wallet seed. Deriving it
 * deterministically means the same wallet always posts under the same
 * anonymous author commitment, without us having to persist a separate key.
 */
export function deriveAuthorSecretKey(seed: string): Uint8Array {
  return new Uint8Array(
    crypto.createHash('sha256').update(`guestbook:author-secret:${seed}`).digest(),
  );
}

/** Build the initial private state for a given wallet seed. */
export function makeInitialPrivateState(seed: string): GuestbookPrivateState {
  return { authorSecretKey: deriveAuthorSecretKey(seed) };
}

/**
 * The witness object handed to the compiled contract. The runtime calls
 * `authorSecretKey` with the current context and expects back a tuple of
 * `[nextPrivateState, returnValue]`. We return the state unchanged and hand
 * the circuit the secret key it asked for.
 */
export const witnesses = {
  authorSecretKey(
    context: { privateState: GuestbookPrivateState },
  ): [GuestbookPrivateState, Uint8Array] {
    return [context.privateState, context.privateState.authorSecretKey];
  },
};
