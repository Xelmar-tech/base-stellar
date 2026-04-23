import express from "express";
import cors from "cors";
import { getVaultBalances } from "./balances";
import { deployVault } from "./impl";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(cors({ origin: ["https://paynest.xyz", "http://localhost:3000"] }));

app.post("/deploy-vault", async (req, res) => {
  try {
    const vaultAddress = await deployVault();
    res.json({ vaultAddress });
  } catch (error) {
    console.error(error);
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
