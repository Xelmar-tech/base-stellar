import express from "express";
import cors from "cors";
import StellarSDK from "@stellar/stellar-sdk";
import { deployVaultForUser, loadWasm } from "./script-deploy";

const CONFIG = {
  testnet: {
    horizonUrl: "https://horizon-testnet.stellar.org",
  },
  mainnet: {
    horizonUrl: "https://horizon.stellar.org",
  },
};

type Network = keyof typeof CONFIG;

async function getBalances(
  network: Network,
  address: string,
): Promise<{ xlm: string; usdc: string }> {
  const net = CONFIG[network];
  const server = new StellarSDK.Server(net.horizonUrl);

  const account = await server.loadAccount(address);

  const balances: { xlm: string; usdc: string } = { xlm: "0", usdc: "0" };

  for (const balance of account.balances) {
    if (balance.asset_type === "native") {
      balances.xlm = balance.balance;
    } else if (balance.asset_code === "USDC") {
      balances.usdc = balance.balance;
    }
  }

  return balances;
}

const app = express();
const PORT = process.env.PORT || 8080;

let wasmPath: string;

try {
  wasmPath = loadWasm();
} catch (e) {
  console.error("Failed to load WASM:", e);
  process.exit(1);
}

app.use(express.json());
app.use(cors({ origin: ["https://paynest.xyz", "http://localhost:3000"] }));

app.post("/deploy-stellar-vault", async (req, res) => {
  try {
    const network = (req.body.network as "testnet" | "mainnet") || "testnet";
    const vaultAddress = await deployVaultForUser(network, wasmPath);
    res.json({ vaultAddress });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/balances/:address", async (req, res) => {
  try {
    const network = (req.query.network as Network) || "testnet";
    const { address } = req.params;
    const balances = await getBalances(network, address);
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
