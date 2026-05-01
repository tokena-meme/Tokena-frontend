# 🚀 Tokena Launchpad (Open Source Frontend)

![Tokena Banner](/banner.png) <!-- Optional: Add a link to a cool banner image here -->

Tokena is a decentralized, open-source token launchpad supporting both **EVM bonding curves** and **Solana (Meteora DBC)**. It allows anyone to launch a token in seconds. On EVM chains, when a token reaches its bonding curve threshold, liquidity is automatically migrated and locked in a DEX router (Uniswap, PancakeSwap) atomically in the same buy transaction. On Solana, tokens use Meteora's Dynamic Bonding Curve SDK with auto-graduation to DAMM V2 pools.

This repository contains the official frontend React application, built with Vite, and the [Tokena SDK](https://www.npmjs.com/package/@tokena/sdk).

🌐 **Live App:** [tokena.meme](https://tokena.meme)  
📦 **Tokena SDK:** [@tokena/sdk](https://www.npmjs.com/package/@tokena/sdk)  

## ✨ Features

### Multi-Chain
*   **EVM Chains:** Ethereum, Base, BSC, Arbitrum — deploy ERC20 tokens via factory contracts.
*   **Solana:** Launch SPL tokens via Meteora Dynamic Bonding Curve SDK.

### EVM
*   **Auto-Migration:** When a token reaches its ETH threshold, the buy transaction atomically creates the Uniswap/PancakeSwap pair, adds liquidity, and locks it — all in one transaction. No manual finalization needed.
*   **Tax Tokens:** Optional buy/sell tax with dev and marketing wallets.
*   **Pending Trade Recovery:** Trades saved to `localStorage` before confirmation. If the user closes the browser, trades are recovered and synced to the database on the next page load.

### Solana
*   **Meteora DBC Integration:** Full bonding curve with `buildCurveWithMarketCap`, auto-graduation to DAMM V2.
*   **Fee Splitting:** 1% trading fee — 0.2% Meteora protocol, 0.4% creator, 0.4% platform (split at claim time).
*   **Initial Buy Bundling:** Optional initial buy as a separate transaction after pool creation.

### Shared
*   **Live Bonding Curves:** Real-time price calculation and chart rendering.
*   **Live Trade Feed:** Real-time WebSocket streaming of buys and sells via Supabase.
*   **Creator Profiles:** Built-in vanity profiles for token deployers.

## 🛠 Tech Stack
*   **Framework:** React 18 + Vite + TypeScript
*   **Styling:** CSS + Lucide Icons
*   **EVM Web3:** `ethers.js v6` — static network config, batch-disabled, 30s polling for free RPC compatibility
*   **Solana Web3:** `@solana/web3.js` + `@meteora-ag/dynamic-bonding-curve-sdk`
*   **Backend/Database:** Supabase (PostgreSQL + Realtime WebSockets)
*   **Storage:** IPFS (via Pinata)

## 🚀 Getting Started

### Prerequisites
*   Node.js 18+
*   A Supabase Project (for database and real-time feeds)
*   A Pinata Account (for IPFS image uploads)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/tokena-meme/tokena-frontend.git
   cd tokena-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add your keys (see `.env.example`):
   ```env
   VITE_SOLANA_RPC_URL=
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   VITE_PINATA_GATEWAY=
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## 📜 Smart Contracts

### EVM — Auto-Migration Bonding Curve
The frontend interfaces with the Tokena Factory contracts. The factory smart contract has been deployed and unified to `0x153B33eee6412066f187B2146deEC10A3A4893C3` across all supported EVM chains.

**Auto-Migration:** When a token reaches its bonding curve threshold during a `buy()` call, the contract automatically:
1. Creates the Uniswap/PancakeSwap trading pair
2. Adds liquidity (tokens + ETH)
3. Locks the LP forever
4. Emits an `AutoFinalized` event

All in the **same transaction** — no separate finalization step required.

| Chain | Key | Factory | Migration DEX Router |
|---|---|---|---|
| Ethereum | `ethereum` | `0x153B33eee6412066f187B2146deEC10A3A4893C3` | `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D` (Uniswap V2) |
| BNB Chain | `bsc` | `0x153B33eee6412066f187B2146deEC10A3A4893C3` | `0x10ED43C718714eb63d5aA57B78B54704E256024E` (PancakeSwap V2) |
| Base | `base` | `0x153B33eee6412066f187B2146deEC10A3A4893C3` | `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` (Uniswap V2) |
| Arbitrum | `arbitrum` | `0x153B33eee6412066f187B2146deEC10A3A4893C3` | `0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506` (SushiSwap V2) |
| Sepolia Testnet | `sepolia` | `0x153B33eee6412066f187B2146deEC10A3A4893C3` | `0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008` (Uniswap V2 Fork) |

### Solana — Meteora Dynamic Bonding Curve
Tokens launch via the [Meteora DBC SDK](https://docs.meteora.ag/docs/dbc/overview) with auto-graduation to DAMM V2 liquidity pools.

| Param | Value |
|---|---|
| Program ID | `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` |
| Token Decimals | 6 |
| Total Supply | 1,000,000,000 |
| Initial LP (virtual) | 5 SOL |
| Migration Threshold | 25 SOL raised |
| Trading Fee | 1% (0.2% Meteora, 0.4% creator, 0.4% platform) |
| Migration | Auto-graduation to DAMM V2 (100% permanent locked LP) |

## 📦 Tokena SDK

The SDK (`axolotl/`) supports both EVM and Solana:

```typescript
import { Tokena, solana } from '@tokena/sdk';

// EVM
const tokena = new Tokena({ chainKey: 'bsc' });
const state = await tokena.getTokenState('0x...');

// Solana
const result = await solana.buyTokens({
  poolAddress: '...',
  mintAddress: '...',
  wallet, connection,
  solAmount: 0.5,
});
```

See the [SDK README](./axolotl/README.md) for full documentation.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/tokena-meme/tokena-frontend/issues).

## 📄 License
This project is [MIT](https://opensource.org/licenses/MIT) licensed.
