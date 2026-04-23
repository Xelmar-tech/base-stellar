import express from "express";
import cors from "cors";
import { deployVaultForUser, loadWasm } from "./script-deploy";

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
app.use(cors({ origin: "https://paynest.xyz" }));

app.post("/deploy-stellar-vault", async (req, res) => {
  try {
    const network = (req.body.network as "testnet" | "mainnet") || "testnet";
    const vaultAddress = await deployVaultForUser(network, wasmPath);
    res.json({ vaultAddress });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
