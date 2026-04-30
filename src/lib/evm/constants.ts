// Supported EVM chain configurations
export interface EvmChainConfig {
  chainId: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  factoryAddress: string;
  // UI visibility - only these chains appear in the selector
  visibleInUi: boolean;
}

export const EVM_CHAINS: Record<string, EvmChainConfig> = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    shortName: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    factoryAddress: '0x3bF3A8384998B600acca63bc04fa251D617De059', // TokenFactory on ETH
    visibleInUi: true, // Visible
  },
  bsc: {
    chainId: 56,
    name: 'BNB Chain',
    shortName: 'BSC',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    factoryAddress: '0x3bF3A8384998B600acca63bc04fa251D617De059', // TokenFactory on BSC
    visibleInUi: true, // Visible
  },
  base: {
    chainId: 8453,
    name: 'Base',
    shortName: 'BASE',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    factoryAddress: '0x3bF3A8384998B600acca63bc04fa251D617De059', // TokenFactory on Base
    visibleInUi: true, // Visible
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum',
    shortName: 'ARB',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    factoryAddress: '0x3bF3A8384998B600acca63bc04fa251D617De059', // TokenFactory on Arbitrum
    visibleInUi: true, // Visible
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    shortName: 'SEP',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    factoryAddress: '0x3bF3A8384998B600acca63bc04fa251D617De059', // TokenFactory on Sepolia
    visibleInUi: false, // Hidden — testnet only
  },
};

// Chains visible in the UI
export const VISIBLE_EVM_CHAINS = Object.entries(EVM_CHAINS)
  .filter(([, c]) => c.visibleInUi)
  .map(([key, config]) => ({ key, ...config }));

// Get chain config by chainId
export function getEvmChainById(chainId: number): EvmChainConfig | undefined {
  return Object.values(EVM_CHAINS).find((c) => c.chainId === chainId);
}

// Get chain key by chainId
export function getEvmChainKey(chainId: number): string | undefined {
  return Object.entries(EVM_CHAINS).find(([, c]) => c.chainId === chainId)?.[0];
}

// Default EVM chain
export const DEFAULT_EVM_CHAIN = 'ethereum';
