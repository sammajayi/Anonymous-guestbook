/**
 * Offline test suite for the guestbook contract.
 *
 * These tests run the compiled circuit locally against the Compact runtime —
 * no devnet, no proof server, no network. They verify both the functional
 * behaviour (a message and post count are written to public state) and, most
 * importantly, the PRIVACY property: the private witness (the author's secret
 * key) never leaks into the public ledger state, while the deliberately
 * disclosed author commitment does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  createConstructorContext,
  createCircuitContext,
  dummyContractAddress,
  emptyZswapLocalState,
} from '@midnight-ntwrk/compact-runtime';

import { witnesses, makeInitialPrivateState, deriveAuthorSecretKey } from '../src/witnesses.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.resolve(
  __dirname,
  '..',
  'contracts',
  'managed',
  'hello-world',
  'contract',
  'index.js',
);
const Guestbook = await import(pathToFileURL(contractPath).href);

const TEST_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
const COIN_PUBLIC_KEY = '0'.repeat(64);

/** Build a fresh contract instance and run its constructor. */
function freshContract(seed = TEST_SEED) {
  const contract = new Guestbook.Contract(witnesses);
  const initialPrivateState = makeInitialPrivateState(seed);
  const constructorContext = createConstructorContext(initialPrivateState, COIN_PUBLIC_KEY);
  const { currentContractState, currentPrivateState, currentZswapLocalState } =
    contract.initialState(constructorContext);
  return { contract, currentContractState, currentPrivateState, currentZswapLocalState, initialPrivateState };
}

/** Invoke storeMessage against a contract state and return the new ledger + context. */
function callStoreMessage(contract: any, contractState: any, privateState: any, zswap: any, message: string) {
  const context = createCircuitContext(
    dummyContractAddress(),
    zswap ?? emptyZswapLocalState(COIN_PUBLIC_KEY),
    contractState.data,
    privateState,
  );
  const results = contract.circuits.storeMessage(context, message);
  const ledger = Guestbook.ledger(results.context.currentQueryContext.state);
  return { results, ledger };
}

test('constructor initializes empty public state', () => {
  const { currentContractState } = freshContract();
  const ledger = Guestbook.ledger(currentContractState.data);
  assert.equal(ledger.message, '');
  assert.equal(ledger.postCount, 0n);
  assert.equal(ledger.author.length, 32);
});

test('storeMessage publishes the message and increments the counter', () => {
  const { contract, currentContractState, currentPrivateState, currentZswapLocalState } = freshContract();
  const { ledger } = callStoreMessage(
    contract,
    currentContractState,
    currentPrivateState,
    currentZswapLocalState,
    'gm from midnight',
  );
  assert.equal(ledger.message, 'gm from midnight');
  assert.equal(ledger.postCount, 1n);
});

test('PRIVACY: the private witness secret never appears in public state', () => {
  const { contract, currentContractState, currentPrivateState, currentZswapLocalState } = freshContract();
  const secret = deriveAuthorSecretKey(TEST_SEED);
  const { ledger } = callStoreMessage(
    contract,
    currentContractState,
    currentPrivateState,
    currentZswapLocalState,
    'secret should not leak',
  );
  // The disclosed author commitment is public and 32 bytes...
  assert.equal(ledger.author.length, 32);
  // ...but it must NOT equal the raw secret key.
  assert.notDeepEqual(Array.from(ledger.author), Array.from(secret));
});

test('PRIVACY: the author commitment is deterministic per author', () => {
  // Two posts from the same seed produce the same anonymous author commitment.
  const a = freshContract(TEST_SEED);
  const first = callStoreMessage(a.contract, a.currentContractState, a.currentPrivateState, a.currentZswapLocalState, 'one');

  const b = freshContract(TEST_SEED);
  const second = callStoreMessage(b.contract, b.currentContractState, b.currentPrivateState, b.currentZswapLocalState, 'two');

  assert.deepEqual(Array.from(first.ledger.author), Array.from(second.ledger.author));
});

test('PRIVACY: different authors produce different commitments', () => {
  const seedA = '11'.repeat(32);
  const seedB = '22'.repeat(32);

  const a = freshContract(seedA);
  const first = callStoreMessage(a.contract, a.currentContractState, a.currentPrivateState, a.currentZswapLocalState, 'hi');

  const b = freshContract(seedB);
  const second = callStoreMessage(b.contract, b.currentContractState, b.currentPrivateState, b.currentZswapLocalState, 'hi');

  assert.notDeepEqual(Array.from(first.ledger.author), Array.from(second.ledger.author));
});
