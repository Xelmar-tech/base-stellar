import express from "express";
import cors from "cors";
import { deployVaultForUser, loadWasm } from "./script-deploy";
import { getVaultBalances } from "./balances";

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

app.post("/deploy-vault", async (req, res) => {
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
    const { address } = req.params;
    console.log(`Fetching balances for ${address}...`);
    const balances = await getVaultBalances(address);
    console.log(balances);

    res.json(balances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
