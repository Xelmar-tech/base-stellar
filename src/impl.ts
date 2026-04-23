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
import { Api, Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import * as dotenv from "dotenv";

dotenv.config();

const cfg = {
  rpcUrl: "https://rpc.ankr.com/stellar_soroban",
  passphrase: Networks.PUBLIC,
  gateway: "CD6VSKXB4HY2DWU7EP2PUIYTBJBJ36LDJXEZN4NSXFYF5YP37DDFX6NF",
  sourceAddress: "0x1fC2276Cf55574236340Db742658b972D5320d7a",
  sourceChain: "base",
  wasmHash: "354d8735ca76ce9a0ca6895646b7c7a0dfc0e93929897a749212b8852ca403aa",
};

async function pollTransaction(server: Server, hash: string) {
  for (let i = 0; i < 20; i++) {
    const result = await server.getTransaction(hash);
    if (result.status === "SUCCESS") return result;
    if (result.status === "FAILED")
      throw new Error(`Transaction failed: ${hash}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Transaction not confirmed after 60s: ${hash}`);
}

async function submitAndWait(
  server: Server,
  keypair: Keypair,
  tx: Transaction,
) {
  const simulated = await server.simulateTransaction(tx);
  if ("error" in simulated)
    throw new Error(`Simulation failed: ${simulated.error}`);

  const prepared = assembleTransaction(tx, simulated).build();
  prepared.sign(keypair);

  const { hash } = await server.sendTransaction(prepared);
  return pollTransaction(server, hash);
}

function extractContractId(result: Api.GetSuccessfulTransactionResponse) {
  // Contract ID is in the transaction result's returnValue
  const returnVal = result.returnValue;
  if (!returnVal) throw new Error("No return value in deploy result");
  const addr = scValToNative(returnVal);
  if (typeof addr !== "string" || !addr.startsWith("C")) {
    throw new Error(`Unexpected contract ID format: ${addr}`);
  }
  return addr;
}

export async function deployVault() {
  const keypair = Keypair.fromSecret(process.env.WALLET_SECRET!);
  const server = new Server(cfg.rpcUrl);
  const horizon = new Horizon.Server("https://horizon.stellar.org"); // for account loading

  // ── Step 1: Instantiate from existing WASM hash ──────────────────────────
  const account = await horizon.loadAccount(keypair.publicKey());
  const salt = crypto.getRandomValues(new Uint8Array(32));

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

  const deployResult = await submitAndWait(server, keypair, deployTx);
  const contractId = extractContractId(deployResult);
  console.log(`Contract deployed: ${contractId}`);

  // ── Step 2: Init ─────────────────────────────────────────────────────────
  const freshAccount = await horizon.loadAccount(keypair.publicKey());

  const initTx = new TransactionBuilder(freshAccount, {
    fee: BASE_FEE,
    networkPassphrase: cfg.passphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
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

  await submitAndWait(server, keypair, initTx);
  console.log(`Vault initialized: ${contractId}`);

  return contractId;
}
