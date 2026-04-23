import { EventEmitter } from "events";
import { deployVault } from "./impl";

const events = new EventEmitter();

events.on("deploy", async (data: { orgId: string; saltHex: string }) => {
  const contract = await deployVault(data.saltHex);
  console.log(`Deployed vault for org ${data.orgId} at address ${contract}`);
});

export default events;
