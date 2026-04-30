# 🚀 Tokena Launchpad (Open Source Frontend)

![Tokena Banner](/banner.png) <!-- Optional: Add a link to a cool banner image here -->

Tokena is a decentralized, open-source token launchpad that utilizes EVM bonding curves. It allows anyone to launch a token in seconds. Once a token reaches its bonding curve threshold, liquidity is automatically migrated and locked in a DEX router (like Uniswap or PancakeSwap).

This repository contains the official frontend React application, built with Vite, TailwindCSS, and the [Tokena SDK](https://www.npmjs.com/package/@tokena/sdk).

🌐 **Live App:** [tokena.meme](https://tokena.meme)  
📦 **Tokena SDK:** [@tokena/sdk](https://www.npmjs.com/package/@tokena/sdk)  

## ✨ Features
*   **Instant Token Creation:** Deploy ERC20 tokens directly to EVM chains via factory contracts.
*   **Live Bonding Curves:** Real-time price calculation and chart rendering.
*   **Multi-chain Support:** Ethereum, Base, BSC, Arbitrum, and Sepolia.
*   **Live Trade Feed:** Real-time WebSocket streaming of buys and sells.
*   **Auto-Migration:** UI seamlessly transitions when a token hits its funding goal and migrates to a DEX.
*   **Creator Profiles:** Built-in vanity profiles for token deployers.

## 🛠 Tech Stack
*   **Framework:** React 18 + Vite + TypeScript
*   **Styling:** TailwindCSS + Lucide Icons
*   **Web3:** `ethers.js` via `@tokena/sdk`
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
The frontend interfaces with the Tokena Factory contracts. If you wish to deploy your own version of the contracts to earn fees on your own launchpad, check out the [Tokena SDK documentation](https://www.npmjs.com/package/@tokena/sdk) for factory addresses and deployment instructions.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/tokena-meme/tokena-frontend/issues).

## 📄 License
This project is [MIT](https://opensource.org/licenses/MIT) licensed.
