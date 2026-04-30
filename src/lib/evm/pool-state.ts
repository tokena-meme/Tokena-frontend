import { Contract, formatEther, formatUnits } from 'ethers';
import { BondingCurveABI } from './abi';
import { getEvmProvider } from './provider';

export interface EvmTokenState {
  currentPrice: string; // in wei (raw PRECISION)
  currentPriceEth: number; // human-readable ETH price
  ethBalance: number; // contract ETH balance
  tokenReserve: number; // tokens held by contract
  ethThreshold: number;
  thresholdReached: boolean;
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

  const [
    name,
    symbol,
    decimals,
    totalSupply,
    currentPrice,
    ethThreshold,
    thresholdReached,
    isTaxToken,
    tokenReserve,
    taxInfo,
  ] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
    token.totalSupply(),
    token.getCurrentPrice(),
    token.ethThreshold(),
    token.thresholdReached(),
    token.isTaxToken(),
    token.balanceOf(tokenAddress),
    token.taxInfo(),
  ]);

  const ethBalance = await provider.getBalance(tokenAddress);
  const precision = BigInt(10) ** BigInt(18); // PRECISION = 1e18

  return {
    currentPrice: currentPrice.toString(),
    currentPriceEth: Number(currentPrice) / Number(precision),
    ethBalance: Number(formatEther(ethBalance)),
    tokenReserve: Number(formatUnits(tokenReserve, decimals)),
    ethThreshold: Number(formatEther(ethThreshold)),
    thresholdReached,
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
  const [balance, decimals] = await Promise.all([
    token.balanceOf(walletAddress),
    token.decimals(),
  ]);
  return Number(formatUnits(balance, decimals));
}
