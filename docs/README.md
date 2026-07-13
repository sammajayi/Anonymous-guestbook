# Screenshots

The submission asks for two screenshots. This folder holds text captures of the
exact output; take a terminal screenshot of each command on your machine and
save the images next to these files as `compile.png` and `deploy.png` (the
README links to those names).

## 1. Successful compile (circuits listed)

Run:

```bash
npm run compile
```

`compile-output.txt` in this folder captures the result. The `compact 0.5.1`
CLI itself prints only `Compiling 1 circuits:`; the circuits, the private
witness, and the public ledger fields it generated are read back from
`contracts/managed/hello-world/compiler/contract-info.json` and listed in that
file. To see the full generated interface, open:

```
contracts/managed/hello-world/contract/index.d.ts
```

which shows the `storeMessage` / `authorCommitment` circuits, the
`authorSecretKey` witness, and the `message` / `author` / `postCount` ledger.

## 2. Contract deployed with address

Run:

```bash
npm run setup -- --network preprod
```

On success the deploy prints:

```
  ✅ Contract deployed successfully!

  Contract Address: <address>
```

and writes that address to `.midnight-state.json` under
`deployments.preprod.address`. `deploy-output.txt` will hold the captured run
once the deploy completes. Screenshot the terminal at the "Contract deployed
successfully" line for `deploy.png`.
