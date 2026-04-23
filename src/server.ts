import express from "express";
import cors from "cors";
import { getVaultBalances } from "./balances";
import events from "./events";
import { precomputeContractId } from "./impl";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(cors({ origin: ["https://paynest.xyz", "http://localhost:3000"] }));

app.post("/deploy-vault", async (req, res) => {
  try {
    const { orgId } = req.body;

    const salt = crypto.getRandomValues(new Uint8Array(32));
    const saltHex = Buffer.from(salt).toString("hex");

    events.emit("deploy", { orgId, saltHex });
    const vaultAddress = precomputeContractId(salt);
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
