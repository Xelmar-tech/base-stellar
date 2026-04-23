import { EventEmitter } from "events";
import { deployVault } from "./impl";

const events = new EventEmitter();

events.on("deploy", async (data: { orgId: string; saltHex: string }) => {
  try {
    const contract = await deployVault(data.saltHex);
    console.log(`Deployed vault for org ${data.orgId} at address ${contract}`);
    await fetch("https://app.paynest.xyz/api/workflow/finalize-deploy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY!,
      },
      body: JSON.stringify({
        orgId: data.orgId,
        vaultAddress: contract,
      }),
    });
  } catch (error) {
    console.error(`Failed to deploy vault for org ${data.orgId}:`, error);
  }
});

export default events;
