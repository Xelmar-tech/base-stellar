import { Asset, Horizon, Address, rpc } from "@stellar/stellar-sdk";

const server = new rpc.Server("https://rpc.ankr.com/stellar_soroban");

const USDC_ISSUER_MAINNET =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

async function getVaultBalances(vaultAddress: string) {
  const address = new Address(vaultAddress);

  const [usdcEntry, xlmEntry] = await Promise.all([
    server.getAssetBalance(address, new Asset("USDC", USDC_ISSUER_MAINNET)),
    server.getAssetBalance(address, Asset.native()),
  ]);

  return {
    usdc: usdcEntry?.balanceEntry
      ? Number(BigInt(usdcEntry.balanceEntry.amount)) / 10 ** 7
      : 0,
    xlm: xlmEntry?.balanceEntry
      ? Number(BigInt(xlmEntry.balanceEntry.amount)) / 10 ** 7
      : 0,
  };
}

const g_server = new Horizon.Server("https://horizon.stellar.org");
async function getBalances(address: string) {
  const account = await g_server.loadAccount(address);

  const xlm = account.balances.find((b) => b.asset_type === "native");
  const usdc = account.balances.find(
    (b) =>
      b.asset_type === "credit_alphanum4" &&
      b.asset_code === "USDC" &&
      b.asset_issuer === USDC_ISSUER_MAINNET, // mainnet USDC issuer
  );

  return {
    xlm: xlm ? parseFloat(xlm.balance) : 0,
    usdc: usdc ? parseFloat(usdc.balance) : 0,
  };
}

export { getVaultBalances, getBalances };
