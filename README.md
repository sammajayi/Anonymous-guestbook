# Anonymous Guestbook — a Midnight privacy DApp

A minimal Midnight smart contract that shows off **selective disclosure**:
anyone can post a public message, but the *identity* of each author stays
private. The contract proves every post came from a real, consistent author —
without ever revealing who that author is.

## Product idea

**Anonymous Guestbook** is a public message board where reputation is portable
but identity is not. Each visitor signs their post with a secret key that never
leaves their device. The chain stores only the message and a one-way
*commitment* derived from that key, so the same person always appears under the
same anonymous handle — enough to build a track record or prove "I posted this
earlier" — while never linking that handle back to a wallet or a name. It's a
building block for whistle-blower boards, anonymous product reviews, and
pseudonymous community feeds where you want accountability without surveillance.

## Public state vs private witness

This is the heart of the contract (`contracts/hello-world.compact`):

```compact
// PUBLIC ledger state — written to the blockchain, readable by anyone:
export ledger message: Opaque<"string">;   // the posted message
export ledger author:  Bytes<32>;           // anonymous author commitment
export ledger postCount: Counter;           // number of posts

// PRIVATE witness — provided by the caller's local machine, never published:
witness authorSecretKey(): Bytes<32>;

export circuit storeMessage(customMessage: Opaque<"string">): [] {
    const sk = authorSecretKey();                       // private, stays local
    author  = disclose(authorCommitment(sk));           // deliberately public
    message = disclose(customMessage);                  // deliberately public
    postCount.increment(1);
}
```

| | **Public ledger state** | **Private witness** |
|---|---|---|
| Where it lives | On-chain, in the contract's ledger | Only on the caller's machine (private state) |
| Who can read it | Anyone, via the indexer | Nobody but the caller |
| In this contract | `message`, `author`, `postCount` | `authorSecretKey()` → the 32-byte secret |
| Visibility rule | Included in the transaction | Feeds the ZK proof, never disclosed |

**How `disclose()` is used deliberately.** In Compact, everything derived from a
witness is *private by default* — the compiler refuses to publish it unless you
explicitly wrap it in `disclose()`. We disclose exactly two things:

1. `message` — the post is meant to be public.
2. `authorCommitment(sk)` — a **one-way hash** of the secret key
   (`persistentHash(["guestbook:author:", sk])`), not the key itself.

The raw secret `sk` is **never** wrapped in `disclose()`, so it never reaches
the chain. It is used only to build the zero-knowledge proof that the author
knew the secret behind the commitment. The proof convinces the network the post
is authentic without revealing the secret — that is the whole point of
selective disclosure.

The test suite (`test/guestbook.test.ts`) asserts this property directly: it
runs the circuit and checks that the disclosed `author` field never equals the
raw secret key, that the same author is stable across posts, and that different
authors produce different commitments.

## Quick start

Requirements: Node 22, Docker (with Compose v2), and the Compact compiler
(`compact 0.5.x`; the contract targets language version 0.23).

```bash
npm install
npm run setup          # start local devnet, compile, deploy to the devnet
npm test               # run the offline contract test suite (5 tests)
npm run test:e2e       # reconnect to the deployed contract and read its state
```

`npm run setup` runs end-to-end with no prompts against the bundled local
devnet:

1. `docker compose up -d --wait` — starts node, indexer, and proof-server and
   blocks until all three are healthy.
2. `npm run compile` — compiles `contracts/hello-world.compact` to
   `contracts/managed/hello-world/` (circuits + proving/verifying keys).
3. `npm run deploy` — derives the genesis-seed wallet, registers UTXOs for DUST,
   deploys the contract, writes `.midnight-state.json`.

### Interacting with the contract

```bash
npm run cli            # menu: store a message, read message/author/post count
```

## Deploying to a public testnet (Preprod)

```bash
npm run setup -- --network preprod
```

On first run this generates a fresh wallet, prints its address and the faucet
URL, and polls until the wallet is funded, then deploys. The resulting contract
address is saved to `.midnight-state.json` and printed on success. See the
screenshots below.

> **⚠ Local devnet only:** the `undeployed` network uses a well-known genesis
> seed (`0000…0001`). Never use that seed against a network that holds real
> value.

## Screenshots

| What | File |
|---|---|
| Successful compile (circuits listed) | `docs/compile.png` |
| Contract deployed with address | `docs/deploy.png` |

## Available scripts

| Script | Description |
|---|---|
| `npm run setup` | One-shot: start devnet, compile, deploy. |
| `npm run compile` | Compile the Compact contract to circuits + keys. |
| `npm test` | Offline contract test suite (privacy + behaviour). |
| `npm run deploy` | Deploy the compiled contract. |
| `npm run cli` | Interactive CLI to call circuits on the deployed contract. |
| `npm run check-balance` | Print the wallet's NIGHT and DUST balances. |
| `npm run test:e2e` | Smoke + read-back check against the deployed contract. |
| `npm run clean` | Remove generated state (keeps `contracts/managed/`). |

## Project structure

```
midnight-setup/
├── contracts/
│   ├── hello-world.compact      # the guestbook contract (public state + witness)
│   └── managed/hello-world/     # compiled circuits, keys, zkir (committed)
├── src/
│   ├── witnesses.ts             # witness implementation + private state
│   ├── network.ts               # network selection + state file
│   ├── wallet.ts                # wallet construction + sync cache
│   ├── deploy.ts                # deploy the contract
│   ├── cli.ts                   # interact with the deployed contract
│   └── check-balance.ts         # NIGHT / DUST balances
├── test/
│   └── guestbook.test.ts        # offline privacy + behaviour tests
├── scripts/
│   └── e2e-check.ts             # smoke + read-back
├── docker-compose.yml           # node + indexer + proof-server
└── package.json
```

## How the pieces fit

- **`contracts/hello-world.compact`** declares the public ledger fields, the
  `authorSecretKey` witness, and the `storeMessage` circuit that uses
  `disclose()` deliberately.
- **`src/witnesses.ts`** implements the witness in TypeScript. It derives the
  author secret deterministically from the wallet seed and hands it to the
  circuit at call time — the secret is stored in the private-state provider and
  never sent to the chain.
- **`src/deploy.ts` / `src/cli.ts`** wire the witness and initial private state
  into the SDK via `CompiledContract.withWitnesses(...)` plus
  `privateStateId` / `initialPrivateState`.
