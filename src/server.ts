import express from "express";
import cors from "cors";
import { getVaultBalances } from "./balances";
import events from "./events";
import { precomputeContractId } from "./impl";

const app = express();
const PORT = process.env.PORT || 8080;
const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY is not set in environment variables");
  process.exit(1);
}

app.use(express.json());
app.use(cors({ origin: ["https://paynest.xyz", "http://localhost:3000"] }));

app.post("/deploy-vault", async (req, res) => {
  try {
    const key = req.headers["x-api-key"];
    if (key !== apiKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { orgId } = req.body;

    const salt = crypto.getRandomValues(new Uint8Array(32));
    const saltHex = Buffer.from(salt).toString("hex");

    events.emit("deploy", { orgId, saltHex });
    const vaultAddress = precomputeContractId(saltHex);
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
