import { Contract, formatEther, formatUnits } from 'ethers';
import { BondingCurveABI } from './abi';
import { getEvmProvider } from './provider';

export interface EvmTokenState {
  currentPrice: string; // in wei (raw PRECISION)
  currentPriceEth: number; // human-readable ETH price
  ethBalance: number; // contract ETH balance (total, including fees)
  ammEthReserve: number; // AMM reserve only (excludes pending fees)
  tokenReserve: number; // tokens held by contract
  ethThreshold: number;
  thresholdReached: boolean;
  finalized: boolean; // true after Uniswap liquidity has been added
  migrationFeePercent: number; // migration fee % (0-5)
  uniswapPair: string; // Uniswap pair address (or 0x0 if not created)
  isTaxToken: boolean;
  totalSupply: number;
  name: string;
  symbol: string;
  decimals: number;
  // Tax info
  devWallet: string;
  devBuyFeePercent: number;
  devSellFeePercent: number;
  marketingWallet: string;
  marketingBuyFeePercent: number;
  marketingSellFeePercent: number;
}

export async function getEvmTokenState(
  tokenAddress: string,
  chainKey: string
): Promise<EvmTokenState> {
  const provider = getEvmProvider(chainKey);
  const token = new Contract(tokenAddress, BondingCurveABI, provider);

  // Fetch calls sequentially to avoid burst rate limits on free RPCs
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const currentPrice = await token.getCurrentPrice();
  const isTaxToken = await token.isTaxToken();
  const tokenReserve = await token.balanceOf(tokenAddress);
  const taxInfo = await token.taxInfo();
  const ethBalance = await provider.getBalance(tokenAddress);
  const precision = BigInt(10) ** BigInt(18);

  // Try getMigrationStatus() (new contracts), fall back to individual calls (old contracts)
  let thresholdReached = false;
  let finalized = false;
  let uniswapPair = '0x0000000000000000000000000000000000000000';
  let ammReserve = ethBalance; // fallback: use raw ETH balance
  let ethThreshold = BigInt(0);
  let migrationFeePercent = BigInt(0);

  try {
    const migrationStatus = await token.getMigrationStatus();
    [thresholdReached, finalized, uniswapPair, ammReserve, ethThreshold, migrationFeePercent] = migrationStatus;
  } catch {
    // Old contract — fall back to individual calls
    try {
      thresholdReached = await token.thresholdReached();
      ethThreshold = await token.ethThreshold();
      ammReserve = ethBalance;
      finalized = false;
    } catch (err) {
      console.warn('Failed to read threshold from old contract:', err);
    }
  }

  return {
    currentPrice: currentPrice.toString(),
    currentPriceEth: Number(currentPrice) / Number(precision),
    ethBalance: Number(formatEther(ethBalance)),
    ammEthReserve: Number(formatEther(ammReserve)),
    tokenReserve: Number(formatUnits(tokenReserve, decimals)),
    ethThreshold: Number(formatEther(ethThreshold)),
    thresholdReached,
    finalized,
    migrationFeePercent: Number(migrationFeePercent),
    uniswapPair,
    isTaxToken,
    totalSupply: Number(formatUnits(totalSupply, decimals)),
    name,
    symbol,
    decimals: Number(decimals),
    devWallet: taxInfo.devWallet,
    devBuyFeePercent: Number(taxInfo.devBuyFeePercent),
    devSellFeePercent: Number(taxInfo.devSellFeePercent),
    marketingWallet: taxInfo.marketingWallet,
    marketingBuyFeePercent: Number(taxInfo.marketingBuyFeePercent),
    marketingSellFeePercent: Number(taxInfo.marketingSellFeePercent),
  };
}

// Get user's token balance
export async function getEvmTokenBalance(
  tokenAddress: string,
  walletAddress: string,
  chainKey: string
): Promise<number> {
  const provider = getEvmProvider(chainKey);
  const token = new Contract(tokenAddress, BondingCurveABI, provider);
  const balance = await token.balanceOf(walletAddress);
  const decimals = await token.decimals();
  return Number(formatUnits(balance, decimals));
}
