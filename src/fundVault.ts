import { createPublicClient, createWalletClient, http, parseUnits, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const USDC_DECIMALS = 6;

const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

interface FundParams {
  walletPrivateKey: string;
  vaultAddress: string;
  amount?: string;
  rpcUrl?: string;
}

export async function fundVault(params: FundParams): Promise<string> {
  const {
    walletPrivateKey,
    vaultAddress,
    amount = "10",
    rpcUrl = process.env.BASE_RPC_URL || "https://base-sepolia-public-rpc.sh",
  } = params;

  // USDC on Base Sepolia
  const usdcAddress = "0xCaZRY5GSfbFXd7H6gAFBA5YGYQTDXU4QKWKMYFWBAZFUCURN3WKX6LF5";

  const account = privateKeyToAccount(walletPrivateKey as `0x${string}`);
  const wallet = createWalletClient({
    account,
    chain: {
      id: 84532,
      name: "Base Sepolia",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: {
      id: 84532,
      name: "Base Sepolia",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl),
  });

  // Parse amount (default 10 USDC with 6 decimals)
  const amountWei = parseUnits(amount, USDC_DECIMALS);

  console.log(`💰 Funding vault: ${vaultAddress}`);
  console.log(`   Amount: ${amount} USDC (${amountWei})`);
  console.log(`   From: ${account.address}`);

  // Check balance first
  const balance = await publicClient.readContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [account.address as `0x${string}`],
  });

  console.log(`   Your USDC balance: ${balance}`);

  if (balance < amountWei) {
    throw new Error(`Insufficient USDC balance! Have ${balance}, need ${amountWei}`);
  }

  const calldata = encodeFunctionData({
    abi: USDC_ABI,
    functionName: "transfer",
    args: [vaultAddress as `0x${string}`, amountWei],
  });

  const hash = await wallet.sendTransaction({
    to: usdcAddress as `0x${string}`,
    data: calldata,
  });

  console.log(`✅ Funded! Transaction: ${hash}`);

  // Verify
  const newBalance = await publicClient.readContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [vaultAddress as `0x${string}`],
  });

  console.log(`   Vault USDC balance: ${newBalance}`);

  return hash;
}

async function main() {
  const args = process.argv.slice(2);
  let vaultAddress = process.env.VAULT_ADDRESS;
  let amount = "10";

  // Parse args: npx ts-node src/fundVault.ts <vaultAddress> [amount]
  if (args.length > 0) {
    vaultAddress = args[0];
  }
  if (args.length > 1) {
    amount = args[1];
  }

  const walletPrivateKey = process.env.WALLET_PRIVATE_KEY;

  if (!walletPrivateKey) {
    console.error("Missing WALLET_PRIVATE_KEY in .env");
    process.exit(1);
  }
  if (!vaultAddress) {
    console.error("Usage: npx ts-node src/fundVault.ts <vaultAddress> [amount]");
    console.error("  or set VAULT_ADDRESS in .env");
    process.exit(1);
  }

  await fundVault({
    walletPrivateKey,
    vaultAddress,
    amount,
  });
}

main().catch(console.error);