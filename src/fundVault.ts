import { execSync } from "child_process";
import * as dotenv from "dotenv";

dotenv.config();

const STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const DEFAULT_USDC_ID =
  "CAZRY5GSFBFXD7H6GAFBA5YGYQTDXU4QKWKMYFWBAZFUCURN3WKX6LF5";

interface FundParams {
  walletSecret: string;
  vaultAddress: string;
  amount?: string;
  tokenId?: string;
}

export async function fundVault(params: FundParams): Promise<string> {
  const {
    walletSecret,
    vaultAddress,
    amount = "10",
    tokenId = DEFAULT_USDC_ID,
  } = params;

  console.log(`💰 Funding Stellar vault: ${vaultAddress}`);
  console.log(`   Amount: ${amount} token`);
  console.log(`   Token ID: ${tokenId}`);
  console.log(
    `   From wallet: ${walletSecret.slice(0, 4)}...${walletSecret.slice(-4)}`,
  );

  // Parse amount (USDC/Tokens on Stellar use 7 decimals)
  const amountScaled = Math.floor(parseFloat(amount) * 1e7);

  const cmd = `stellar contract invoke \
    --id ${tokenId} \
    --source-account "${walletSecret}" \
    --rpc-url "${STELLAR_RPC_URL}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" \
    -- \
    transfer \
    --from "${walletSecret}" \
    --to "${vaultAddress}" \
    --amount "${amountScaled}"`;

  try {
    const output = execSync(cmd, { encoding: "utf8" });
    console.log(`✅ Funded! ${output}`);
    return output;
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    console.log(
      `\n💡 If token contract not found, use correct USDC contract ID:`,
    );
    console.log(
      `   npx ts-node src/fundVault.ts <vaultAddress> <amount> <tokenContractId>`,
    );
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let amount = "10";
  let tokenId = DEFAULT_USDC_ID;

  const vaultAddress = args[0];
  if (args.length > 1) amount = args[1];

  const walletSecret = process.env.WALLET_SECRET;

  if (!walletSecret) {
    console.error("Missing WALLET_SECRET in .env");
    process.exit(1);
  }
  if (!vaultAddress) {
    console.error(
      "Usage: npx ts-node src/fundVault.ts <vaultAddress> [amount] [tokenContractId]",
    );
    console.error("  vaultAddress: Your Stellar vault contract ID");
    console.error("  amount: Amount to fund (default: 10)");
    console.error(
      "  tokenContractId: Token contract ID (optional, defaults to USDC testnet)",
    );
    process.exit(1);
  }

  await fundVault({ walletSecret, vaultAddress, amount, tokenId });
}

main().catch(console.error);
