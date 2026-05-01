import { JsonRpcProvider, BrowserProvider, JsonRpcSigner, Network } from 'ethers';
import { EVM_CHAINS } from './constants';

// Read-only provider for a given chain
const providerCache = new Map<string, JsonRpcProvider>();

export function getEvmProvider(chainKey: string): JsonRpcProvider {
  const cached = providerCache.get(chainKey);
  if (cached) return cached;
  
  const config = EVM_CHAINS[chainKey];
  if (!config) throw new Error(`Unknown EVM chain: ${chainKey}`);

  // Create a bare Network — do NOT use Network.from() which loads built-in Infura plugins
  const network = new Network(config.name, config.chainId);
  
  const provider = new JsonRpcProvider(config.rpcUrl, network, {
    batchMaxCount: 1,       // No batching — prevents one failed method from poisoning others
    staticNetwork: network, // Prevents _detectNetwork which redirects to built-in Infura endpoints
    pollingInterval: 30000, // 30s polling to avoid rate limits on free RPCs
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
