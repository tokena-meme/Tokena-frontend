import { Connection } from '@solana/web3.js';
import { 
  quoteBuyOffchain, 
  quoteSellOffchain, 
  getCachedSolPrice 
} from '../utils/marketcap';
import { getLaunchByMint } from '../supabase/queries';

export interface BuyQuote {
  tokensOut: number;
  priceImpact: number;
  pricePerToken: number;
  feeSol: number;
  minimumReceived: number;
}

export interface SellQuote {
  solOut: number;
  priceImpact: number;
  pricePerToken: number;
  feeSol: number;
  minimumReceived: number;
}

export async function quoteBuy(
  mintAddress: string,
  solAmount: number,
  slippageBps: number = 100,
  connection: Connection
): Promise<BuyQuote> {
  const launch = await getLaunchByMint(mintAddress);
  if (!launch) throw new Error('Launch not found');

  const solPriceUsd = await getCachedSolPrice();
  const currentRaised = launch.sol_raised ?? 0;

  const result = quoteBuyOffchain(solAmount, currentRaised, solPriceUsd);
  
  const tokensOut = result.tokensOut;
  const minimumReceived = tokensOut * (1 - slippageBps / 10000);
  const pricePerToken = tokensOut > 0 ? solAmount / tokensOut : 0;

  return {
    tokensOut,
    priceImpact: result.priceImpact,
    pricePerToken,
    feeSol: result.feeSol,
    minimumReceived,
  };
}

export async function quoteSell(
  mintAddress: string,
  tokenAmount: number,
  slippageBps: number = 100,
  connection: Connection
): Promise<SellQuote> {
  const launch = await getLaunchByMint(mintAddress);
  if (!launch) throw new Error('Launch not found');

  const solPriceUsd = await getCachedSolPrice();
  const currentRaised = launch.sol_raised ?? 0;

  const result = quoteSellOffchain(tokenAmount, currentRaised, solPriceUsd);

  const solOut = result.solOut;
  const minimumReceived = solOut * (1 - slippageBps / 10000);
  const pricePerToken = solOut > 0 ? solOut / tokenAmount : 0;

  return {
    solOut,
    priceImpact: result.priceImpact,
    pricePerToken,
    feeSol: result.feeSol,
    minimumReceived,
  };
}
