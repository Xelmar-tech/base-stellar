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
    rpcUrl: "https://rpc.ankr.com/stellar_soroban",
    passphrase: "Public Global Stellar Network ; September 2015",
    gateway: "CD6VSKXB4HY2DWU7EP2PUIYTBJBJ36LDJXEZN4NSXFYF5YP37DDFX6NF",
    sourceAddress: "0x7Ce3178161ff18aE26E0419C0c305AE2985e99e0",
    sourceChain: "base",
  },
};

type Network = keyof typeof CONFIG;

function buildVault(): string {
  console.log("🏗️  Building vault contract...");

  const vaultDir = path.join(__dirname, "..", "vault");

  execSync(`cd "${vaultDir}" && cargo build --release --target wasm32v1-none`, {
    stdio: "inherit",
  });

  const wasmPath = path.join(
    vaultDir,
    "target",
    "wasm32v1-none",
    "release",
    "vault.wasm",
  );

  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM not found at ${wasmPath}`);
  }

  console.log(`✅ Built: ${wasmPath}`);
  return wasmPath;
}

function deployVault(
  wasmPath: string,
  walletSecret: string,
  network: Network,
): string {
  console.log("🚀 Deploying vault...");

  const net = CONFIG[network];
  const cmd = `stellar contract deploy --source-account "${walletSecret}" --wasm "${wasmPath}" --rpc-url "${net.rpcUrl}" --network-passphrase "${net.passphrase}"`;

  const output = execSync(cmd, { encoding: "utf8", stdio: "pipe" });
  const contractId = output.trim();

  if (!contractId.startsWith("C")) {
    throw new Error(`Deployment failed: ${contractId}`);
  }

  console.log(`✅ Contract deployed: ${contractId}`);
  return contractId;
}

function initVault(
  contractId: string,
  walletSecret: string,
  network: Network,
): void {
  console.log("🔧 Initializing vault...");

  const net = CONFIG[network];
  const cmd = `stellar contract invoke \
    --source-account "${walletSecret}" \
    --id ${contractId} \
    --rpc-url "${net.rpcUrl}" \
    --network-passphrase "${net.passphrase}" \
    -- \
    init \
    --gateway ${net.gateway} \
    --source-address ${net.sourceAddress} \
    --source-chain ${net.sourceChain}`;

  execSync(cmd, { encoding: "utf8", stdio: "inherit" });
  console.log("✅ Initialized!");
}

async function main() {
  console.time("Total deployment time");
  const walletSecret = process.env.WALLET_SECRET;
  const network = (process.env.NETWORK as Network) || "testnet";

  if (!walletSecret) {
    console.error("Missing WALLET_SECRET in .env!");
    console.error("\nCreate .env file with:");
    console.error("  WALLET_SECRET=your_lobstr_secret_key");
    console.error("\nThen run:");
    console.error("  npx ts-node src/deploy.ts        # testnet");
    console.error("  NETWORK=mainnet npx ts-node src/deploy.ts  # mainnet");
    process.exit(1);
  }

  if (!CONFIG[network]) {
    console.error(`Invalid network: ${network}. Use: testnet or mainnet`);
    process.exit(1);
  }

  const net = CONFIG[network];

  console.log(`🌐 Network: ${network.toUpperCase()}`);
  console.log(`📝 Gateway: ${net.gateway}`);
  console.log(`📝 Source:  ${net.sourceAddress}`);

  console.time("Build");
  const wasmPath = buildVault();
  console.timeEnd("Build");

  console.time("Deploy");
  const contractId = deployVault(wasmPath, walletSecret, network);
  console.timeEnd("Deploy");

  console.time("Init");
  initVault(contractId, walletSecret, network);
  console.timeEnd("Init");
  console.timeEnd("Total deployment time");
  console.log(`\n✨ Vault deployed at: ${contractId}`);
  console.log(`   Add this to your Base calling contract: ${contractId}`);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
