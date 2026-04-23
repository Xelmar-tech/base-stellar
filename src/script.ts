import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import * as dotenv from "dotenv";

dotenv.config();

const VAULT_ABI = [
  {
    type: "function",
    name: "registerVault",
    inputs: [{ name: "stellarVault", type: "string", internalType: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdrawFromVault",
    inputs: [
      { name: "stellarToken", type: "string", internalType: "string" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "destinationXlmAddress", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

const vaultAddress = process.env.VAULT_ADDRESS as `0x${string}`;
const token =
  process.env.STELLAR_TOKEN ||
  "CAZRY5GSFBFXD7H6gAFBA5YGYQTDXU4QKWKMYFWBAZFUCUrN3WKX6Lf5";
const destXlm = "GAESXUSMJDAVQ2TQDN4XSWJO4NA7JGV6FKUKYKXXVXD57A6U7R6OQLXF";

async function getClients() {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  const rpcUrl = process.env.RPC_URL;

  if (!rpcUrl) {
    throw new Error("Missing RPC_URL in .env");
  }

  const client = createWalletClient({
    account,
    chain: baseSepolia, // Use Base Sepolia chain
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  return { client, publicClient, account, rpcUrl };
}

export async function registerVault(stellarVault: string): Promise<string> {
  const { client } = await getClients();

  console.log(`📝 Registering Stellar vault: ${stellarVault}`);
  console.log(`🛠️  EVM vault address: ${vaultAddress}`);

  const calldata = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "registerVault",
    args: [stellarVault],
  });

  try {
    const hash = await client.sendTransaction({
      to: vaultAddress,
      data: calldata,
      value: parseEther("0.001"), // Send some ETH to cover future fees
    });

    console.log(`✅ Registered! Transaction: ${hash}`);
    return hash;
  } catch (e: any) {
    console.error(`Transaction failed: ${e.message}`);
    throw e;
  }
}

export async function withdrawFromVault(amount: bigint): Promise<string> {
  const { client } = await getClients();

  console.log(`💸 Requesting withdrawal:`);
  console.log(`   Token: ${token}`);
  console.log(`   Amount: ${amount}`);
  console.log(`   Destination: ${destXlm}`);

  const calldata = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "withdrawFromVault",
    args: [token, amount, destXlm],
  });

  try {
    const hash = await client.sendTransaction({
      to: vaultAddress,
      data: calldata,
      value: parseEther("0.001"), // Send some ETH to cover fees
    });

    console.log(`✅ Withdrawal initiated! Transaction: ${hash}`);
    return hash;
  } catch (e: any) {
    console.error(`Transaction failed: ${e.message}`);
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const walletPrivateKey = process.env.PRIVATE_KEY;

  if (!walletPrivateKey) {
    console.error("Missing PRIVATE_KEY in .env");
    process.exit(1);
  }

  if (!vaultAddress) {
    console.error("Missing VAULT_ADDRESS in .env");
    process.exit(1);
  }

  const action = process.env.ACTION;

  if (action === "register") {
    const stellarVault = args[0] || process.env.STELLAR_VAULT;
    if (!stellarVault) {
      console.error(
        "Usage: ACTION=register npx ts-node src/script.ts <stellarVaultAddress>",
      );
      console.error("  or set STELLAR_VAULT in .env");
      process.exit(1);
    }

    await registerVault(stellarVault);
  } else if (action === "withdraw") {
    const amount = BigInt(process.env.AMOUNT || "1000000"); // 1 USDC

    await withdrawFromVault(amount);
  } else {
    console.log("Usage:");
    console.log("  ACTION=register npx ts-node src/script.ts <stellarVault>");
    console.log("  ACTION=withdraw npx ts-node src/script.ts");
  }
}

main().catch(console.error);
