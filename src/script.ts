import { createWalletClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import * as dotenv from "dotenv";

dotenv.config();

const VAULT_ABI = [
  {
    name: "registerVault",
    type: "function",
    inputs: [{ name: "stellarVault", type: "string", internalType: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "withdrawFromVault",
    type: "function",
    inputs: [
      { name: "stellarToken", type: "string", internalType: "string" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "destinationXlmAddress", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const rpcUrl = process.env.RPC_URL as string;
const client = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(rpcUrl),
});
const vaultAddress = process.env.STELLAR_GATEWAY_CONTRACT as `0x${string}`;

export async function registerVault(stellarVault: string): Promise<string> {
  console.log(`📝 Registering Stellar vault: ${stellarVault}`);
  console.log(`🛠️  EVM vault address: ${vaultAddress}`);

  const calldata = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "registerVault",
    args: [stellarVault],
  });

  const hash = await client.sendTransaction({
    to: vaultAddress,
    data: calldata,
  });

  console.log(`✅ Registered! Transaction: ${hash}`);

  return hash;
}

export async function withdrawFromVault(
  stellarToken: string,
  amount: bigint,
  destinationXlmAddress: string,
): Promise<string> {
  console.log(`💸 Requesting withdrawal:`);
  console.log(`   Token: ${stellarToken}`);
  console.log(`   Amount: ${amount}`);
  console.log(`   Destination: ${destinationXlmAddress}`);

  const calldata = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "withdrawFromVault",
    args: [stellarToken, amount, destinationXlmAddress],
  });

  const hash = await client.sendTransaction({
    to: vaultAddress,
    data: calldata,
  });

  console.log(`✅ Withdrawal initiated! Transaction: ${hash}`);

  return hash;
}

async function main() {
  const walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
  const vaultAddress = process.env.VAULT_ADDRESS;

  if (!walletPrivateKey) {
    console.error("Missing WALLET_PRIVATE_KEY in .env");
    process.exit(1);
  }
  if (!vaultAddress) {
    console.error("Missing VAULT_ADDRESS in .env");
    process.exit(1);
  }

  const action = process.env.ACTION;

  if (action === "register") {
    const stellarVault =
      process.env.STELLAR_VAULT ||
      "CBTIAYYVVHYSSJ7QR6B2KCHMTDHQK65EMDE3CJPHSSNUSIZEDJELTJPZ";
    await registerVault(stellarVault);
  } else if (action === "withdraw") {
    const token = process.env.STELLAR_TOKEN || "USDC";
    const destXlm =
      process.env.DESTINATION_XLM ||
      "GAESXUSMJDAVQ2TQDN4XSWJO4NA7JGV6FKUKYKXXVXD57A6U7R6OQLXF";
    const amount = BigInt(process.env.AMOUNT || "1000000"); // 1 USDC

    await withdrawFromVault(token, amount, destXlm);
  } else {
    console.log("Usage:");
    console.log("  ACTION=register npx ts-node src/script.ts");
    console.log("  ACTION=withdraw npx ts-node src/script.ts");
  }
}

main().catch(console.error);
