import { JsonRpcProvider, BrowserProvider, JsonRpcSigner } from 'ethers';
import { EVM_CHAINS, EvmChainConfig } from './constants';

// Read-only provider for a given chain
const providerCache = new Map<string, JsonRpcProvider>();

export function getEvmProvider(chainKey: string): JsonRpcProvider {
  const cached = providerCache.get(chainKey);
  if (cached) return cached;
  
  const config = EVM_CHAINS[chainKey];
  if (!config) throw new Error(`Unknown EVM chain: ${chainKey}`);
  
  const provider = new JsonRpcProvider(config.rpcUrl, {
    chainId: config.chainId,
    name: config.name,
  });
  providerCache.set(chainKey, provider);
  return provider;
}

// Get a signer from the browser wallet (MetaMask)
export async function getEvmSigner(): Promise<JsonRpcSigner> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('MetaMask not installed');
  const provider = new BrowserProvider(ethereum);
  return provider.getSigner();
}

// Get browser provider
export function getEvmBrowserProvider(): BrowserProvider {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('MetaMask not installed');
  return new BrowserProvider(ethereum);
}
