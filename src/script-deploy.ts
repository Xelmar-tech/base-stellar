import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const CONFIG = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    passphrase: "Test SDF Network ; September 2015",
    gateway: "CB2JYOOZPHO43R57TC5PXV22QICKIDC5NKRF62BZG2J6JYFUIQPIAYY3",
    sourceAddress: "0xa636f92997cd7d6137a5eDb6E110dE03dc7ac0DA",
    sourceChain: "base-sepolia",
  },
  mainnet: {
    rpcUrl: "https://soroban-rpc.stellar.org",
    passphrase: "Public Global Stellar Network ; September 2015",
    gateway: "CD6VSKXB4HY2DWU7EP2PUIYTBJBJ36LDJXEZN4NSXFYF5YP37DDFX6NF",
    sourceAddress: "0xAcb2e7658371AC8efb0d8e3e306AC59B5e1e6fF9",
    sourceChain: "base",
  },
};

type Network = keyof typeof CONFIG;
// Called once at server startup
export function loadWasm(): string {
  const wasmPath = path.join(__dirname, "..", "out", "vault.wasm");

  if (!fs.existsSync(wasmPath)) {
    throw new Error("WASM not found — run cargo build --release first");
  }
  console.log(`Loaded wasm from ${wasmPath}`);

  return wasmPath;
}

// Per-user deployment — no build step
export async function deployVaultForUser(
  network: Network,
  wasmPath: string,
): Promise<string> {
  const net = CONFIG[network];
  const deployerSecret = process.env.WALLET_SECRET;

  if (!deployerSecret) {
    throw new Error("Missing WALLET_SECRET in .env");
  }

  // 1. Deploy (upload + instantiate)
  const output = execSync(
    `stellar contract deploy \
      --source-account "${deployerSecret}" \
      --wasm "${wasmPath}" \
      --rpc-url "${net.rpcUrl}" \
      --network-passphrase "${net.passphrase}"`,
    { encoding: "utf8", stdio: "pipe" },
  );

  const contractId = output.trim();
  if (!contractId.startsWith("C")) {
    throw new Error(`Deploy failed: ${contractId}`);
  }

  // 2. Init
  execSync(
    `stellar contract invoke \
      --source-account "${deployerSecret}" \
      --id ${contractId} \
      --rpc-url "${net.rpcUrl}" \
      --network-passphrase "${net.passphrase}" \
      -- init \
      --gateway ${net.gateway} \
      --source-address ${net.sourceAddress} \
      --source-chain ${net.sourceChain}`,
    { encoding: "utf8", stdio: "pipe" },
  );

  return contractId;
}
