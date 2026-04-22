import { createWalletClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
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
  chain: sepolia,
  transport: http(rpcUrl),
});
const vaultAddress = "0x2ADD8Efa220880b90e288d0AE37a4c833B28354f";
const token = "CAZRY5GSFBFXD7H6GAFBA5YGYQTDXU4QKWKMYFWBAZFUCURN3WKX6LF5";
const destXlm = "GAESXUSMJDAVQ2TQDN4XSWJO4NA7JGV6FKUKYKXXVXD57A6U7R6OQLXF";

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

export async function withdrawFromVault(amount: bigint): Promise<string> {
  console.log(`💸 Requesting withdrawal:`);
  console.log(`   Token: ${token}`);
  console.log(`   Amount: ${amount}`);
  console.log(`   Destination: ${destXlm}`);

  const calldata = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "withdrawFromVault",
    args: [token, amount, destXlm],
  });

  const hash = await client.sendTransaction({
    to: vaultAddress,
    data: calldata,
  });

  console.log(`✅ Withdrawal initiated! Transaction: ${hash}`);

  return hash;
}

async function main() {
  const args = process.argv.slice(2);
  const walletPrivateKey = process.env.PRIVATE_KEY;

  if (!walletPrivateKey) {
    console.error("Missing PRIVATE_KEY in .env");
    process.exit(1);
  }

  const action = process.env.ACTION;

  if (action === "register") {
    const stellarVault = args[0];
    if (!stellarVault) {
      console.error(
        "Usage: ACTION=register npx ts-node src/script.ts <stellarVaultAddress>",
      );
      process.exit(1);
    }

    await registerVault(stellarVault);
  } else if (action === "withdraw") {
    const amount = BigInt("1000000"); // 0.1 USDC

    await withdrawFromVault(amount);
  } else {
    console.log("Usage:");
    console.log("  ACTION=register npx ts-node src/script.ts");
    console.log("  ACTION=withdraw npx ts-node src/script.ts");
  }
}

main().catch(console.error);
