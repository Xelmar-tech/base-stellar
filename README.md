# base-stellar

## Prerequisites

- Node.js and npm
- Rust (1.84+)
- Stellar CLI (Soroban CLI): `cargo install soroban-cli --locked`

## Deployment

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your wallet secret:
   ```
   WALLET_SECRET=your_lobstr_secret_key
   ```

3. Run the deployment:
   ```bash
   npm run deploy
   ```

For mainnet deployment:
```bash
NETWORK=mainnet npm run deploy
```
