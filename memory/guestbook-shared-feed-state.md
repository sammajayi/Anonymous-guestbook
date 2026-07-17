---
name: guestbook-shared-feed-state
description: Universal shared guestbook — on-chain List history, reads from indexer, posts via Lace
metadata:
  type: project
---

The Anonymous Guestbook is a "universal" shared board: one canonical contract everyone reads from and writes to.

**Contract**: `contracts/guestbook.compact` stores full history on-chain as `export ledger entries: List<GuestbookEntry>` (struct of `message` + `author`), appended newest-first via `pushFront`, plus a `postCount` Counter. Deployed to **preview** at `ea9dbaedb92052dd2995d2df7915731685bb8931aa07ac2b486759937a8ee1c8`.

**Read path** (`frontend/src/lib/deploy.ts` `readGuestbook`): reads straight from the preview indexer via `publicDataProvider.queryContractState` + the contract's `ledger()` decoder — no wallet needed, so the feed loads for everyone including logged-out visitors. Preview indexer URIs are hardcoded (`PREVIEW_INDEXER_URI`/`PREVIEW_INDEXER_WS_URI`) since reads happen before wallet connect.

**Canonical address**: frontend reads `NEXT_PUBLIC_GUESTBOOK_ADDRESS` (Vercel env var). When set, the deploy/enter-address UI is hidden; when absent, the deploy flow shows so the contract can be deployed from the frontend.

**Write path**: posts go through Lace via `walletAPI.submitTransaction`. Confirmed working once the Lace wallet is logged in, on Preview, and funded with tNIGHT/DUST.

**Resolved gotcha**: the browser wallet (Lace) is a *different* wallet than the CLI's seed-derived Node wallet — they don't share funds. Earlier "SubmissionError after signing" / "no wallet available" failures were all caused by Lace being **logged out**, not a code bug. Log into Lace on Preview with funds and both deploy and post work.
