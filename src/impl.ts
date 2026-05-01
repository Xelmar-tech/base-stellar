import {
  Keypair,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Operation,
  Address,
  nativeToScVal,
  xdr,
  scValToNative,
  Transaction,
  Horizon,
} from "@stellar/stellar-sdk";
import { hash } from "@stellar/stellar-base";
import {
  Api,
  Server,
  assembleTransaction,
  Durability,
} from "@stellar/stellar-sdk/rpc";
import * as dotenv from "dotenv";

dotenv.config();

const cfg = {
  rpcUrl: "https://rpc.ankr.com/stellar_soroban",
  passphrase: Networks.PUBLIC,
  gateway: "CD6VSKXB4HY2DWU7EP2PUIYTBJBJ36LDJXEZN4NSXFYF5YP37DDFX6NF",
  sourceAddress: "0x7Ce3178161ff18aE26E0419C0c305AE2985e99e0",
  sourceChain: "base",
  wasmHash: "354d8735ca76ce9a0ca6895646b7c7a0dfc0e93929897a749212b8852ca403aa",
};

async function pollTransaction(
  server: Server,
  txHash: string,
  maxAttempts = 60,
  intervalMs = 3000,
) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await server.getTransaction(txHash);
      if (result.status === "SUCCESS") return result;
      if (result.status === "FAILED")
        throw new Error(`Transaction failed: ${txHash}`);
    } catch (e) {
      if (i === maxAttempts - 1) throw e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Transaction not confirmed after ${(maxAttempts * intervalMs) / 1000}s: ${txHash}`,
  );
}

async function submitWithRetry(
  server: Server,
  keypair: Keypair,
  tx: Transaction,
  maxRetries = 3,
): Promise<Api.GetSuccessfulTransactionResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const simulated = await server.simulateTransaction(tx);
      if ("error" in simulated)
        throw new Error(`Simulation failed: ${simulated.error}`);

      const prepared = assembleTransaction(tx, simulated).build();
      prepared.sign(keypair);

      const { hash: txHash } = await server.sendTransaction(prepared);
      return await pollTransaction(server, txHash);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.error(
        `Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`,
      );
      if (attempt < maxRetries) {
        const backoff = attempt * 5000;
        console.log(`Retrying in ${backoff / 1000}s...`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw lastError || new Error("Transaction failed");
}

function extractContractId(result: Api.GetSuccessfulTransactionResponse) {
  const returnVal = result.returnValue;
  if (!returnVal) throw new Error("No return value in deploy result");
  const addr = scValToNative(returnVal);
  if (typeof addr !== "string" || !addr.startsWith("C")) {
    throw new Error(`Unexpected contract ID format: ${addr}`);
  }
  return addr;
}

export function precomputeContractId(saltHex: string): string {
  const keypair = Keypair.fromSecret(process.env.WALLET_SECRET!);
  const deployerPublicKey = keypair.publicKey();
  const salt = Buffer.from(saltHex, "hex");

  const networkId = hash(Buffer.from(Networks.PUBLIC));
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: Address.fromString(deployerPublicKey).toScAddress(),
          salt: Buffer.from(salt),
        }),
      ),
    }),
  );
  return Address.contract(hash(preimage.toXDR())).toString();
}

async function isContractInitialized(
  server: Server,
  contractId: string,
): Promise<boolean> {
  try {
    const key = xdr.ScVal.scvSymbol("init");
    const result = await server.getContractData(
      contractId,
      key,
      Durability.Persistent,
    );
    return result.val !== undefined;
  } catch {
    return false;
  }
}

export async function deployVault(saltHex: string): Promise<string> {
  const keypair = Keypair.fromSecret(process.env.WALLET_SECRET!);
  const server = new Server(cfg.rpcUrl);
  const horizon = new Horizon.Server("https://horizon.stellar.org");

  const contractId = precomputeContractId(saltHex);
  console.log(`Precomputed contract ID: ${contractId}`);

  const alreadyInitialized = await isContractInitialized(server, contractId);
  if (alreadyInitialized) {
    console.log(`Contract ${contractId} already initialized`);
    return contractId;
  }

  const account = await horizon.loadAccount(keypair.publicKey());
  const salt = Buffer.from(saltHex, "hex");

  const deployTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: cfg.passphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeCreateContract(
          new xdr.CreateContractArgs({
            contractIdPreimage:
              xdr.ContractIdPreimage.contractIdPreimageFromAddress(
                new xdr.ContractIdPreimageFromAddress({
                  address: Address.fromString(
                    keypair.publicKey(),
                  ).toScAddress(),
                  salt: Buffer.from(salt),
                }),
              ),
            executable: xdr.ContractExecutable.contractExecutableWasm(
              Buffer.from(cfg.wasmHash, "hex"),
            ),
          }),
        ),
        auth: [],
      }),
    )
    .setTimeout(30)
    .build();

  const deployResult = await submitWithRetry(server, keypair, deployTx);
  const deployedContractId = extractContractId(deployResult);
  console.log(`Contract deployed: ${deployedContractId}`);

  const freshAccount = await horizon.loadAccount(keypair.publicKey());

  const initTx = new TransactionBuilder(freshAccount, {
    fee: BASE_FEE,
    networkPassphrase: cfg.passphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: deployedContractId,
        function: "init",
        args: [
          nativeToScVal(cfg.gateway, { type: "address" }),
          nativeToScVal(cfg.sourceChain, { type: "string" }),
          nativeToScVal(cfg.sourceAddress, { type: "string" }),
        ],
      }),
    )
    .setTimeout(30)
    .build();

  await submitWithRetry(server, keypair, initTx);
  console.log(`Vault initialized: ${deployedContractId}`);

  return deployedContractId;
}
