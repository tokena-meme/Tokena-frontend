import { Contract, parseEther, formatEther, formatUnits } from 'ethers';
import { TokenFactoryABI, BondingCurveABI } from './abi';
import { EVM_CHAINS } from './constants';
import { getEvmSigner, getEvmProvider } from './provider';
import { createLaunch, insertTrade, updateLaunch, getLaunchByMint } from '@/lib/supabase/queries';
import { getEvmTokenState } from './pool-state';

export interface CreateEvmTokenParams {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  totalSupply: string; // in wei (e.g. "1000000000000000000000000000" for 1B with 18 dec)
  ethThreshold: string; // in ETH (e.g. "5")
  isTaxToken: boolean;
  devWallet: string;
  devBuyFeePercent: number;
  devSellFeePercent: number;
  marketingWallet: string;
  marketingBuyFeePercent: number;
  marketingSellFeePercent: number;
  initialBuyEth: string; // in ETH (e.g. "0.1")
  chainKey: string;
  creatorWallet: string;
}

export interface CreateEvmTokenResult {
  tokenAddress: string;
  txHash: string;
}

export async function createEvmToken(params: CreateEvmTokenParams): Promise<CreateEvmTokenResult> {
  const chainConfig = EVM_CHAINS[params.chainKey];
  if (!chainConfig) throw new Error(`Unknown chain: ${params.chainKey}`);
  if (!chainConfig.factoryAddress) throw new Error(`Factory not deployed on ${chainConfig.name}`);

  const signer = await getEvmSigner();
  const factory = new Contract(chainConfig.factoryAddress, TokenFactoryABI, signer);

  const creationFee = await factory.creationFee();
  const initialBuyWei = parseEther(params.initialBuyEth || '0');
  const totalValue = creationFee + initialBuyWei;
  const initialBuyEthNum = parseFloat(params.initialBuyEth || '0');

  const tx = await factory.createBondingCurve(
    params.name,
    params.symbol,
    params.totalSupply,
    parseEther(params.ethThreshold),
    params.isTaxToken,
    params.devWallet || params.creatorWallet,
    params.devBuyFeePercent,
    params.devSellFeePercent,
    params.marketingWallet || params.creatorWallet,
    params.marketingBuyFeePercent,
    params.marketingSellFeePercent,
    initialBuyWei,
    parseEther("1"), // initialVirtualEth fixed at 1 ETH instead of factory default
    { value: totalValue }
  );

  const receipt = await tx.wait();

  // Parse BondingCurveCreated event to get the token address
  let tokenAddress = '';
  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed && parsed.name === 'BondingCurveCreated') {
        tokenAddress = parsed.args.token;
        break;
      }
    } catch {
      // Not our event, skip
    }
  }

  if (!tokenAddress) {
    throw new Error('Failed to parse token address from transaction');
  }

  // Fetch initial curve state directly from the deployed contract
  let initialPriceEth = 0;
  let tokensReceived = 0;
  try {
    const evmState = await getEvmTokenState(tokenAddress, params.chainKey);
    initialPriceEth = evmState.currentPriceEth;

    // Calculate tokens received from initial buy using the Buy event
    if (initialBuyEthNum > 0) {
      const tokenContract = new Contract(tokenAddress, BondingCurveABI, getEvmProvider(params.chainKey));
      for (const log of receipt.logs) {
        try {
          const parsed = tokenContract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.name === 'Buy') {
            tokensReceived = Number(formatUnits(parsed.args[2], 18)); // tokenAmount is arg[2]
            break;
          }
        } catch {
          // Not our event, skip
        }
      }
      // Fallback: estimate from price if event parsing failed
      if (tokensReceived === 0 && initialPriceEth > 0) {
        tokensReceived = initialBuyEthNum / initialPriceEth;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch initial EVM token state:", err);
  }

  // Save launch to Supabase
  const launchRecord = await createLaunch({
    creator_wallet: params.creatorWallet,
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    image_url: params.imageUrl,
    twitter: params.twitter ?? null,
    telegram: params.telegram ?? null,
    website: params.website ?? null,
    mint_address: tokenAddress, // reuse mint_address for EVM token address
    dbc_pool_address: null,
    initial_price_sol: initialPriceEth,
    migration_threshold_sol: 0,
    total_supply: Number(formatUnits(params.totalSupply, 18)),
    creator_fee_percent: 0, // Always 0 to bypass Solana's 5% DB constraint. EVM uses dedicated fee columns below.
    chain: params.chainKey,
    token_address: tokenAddress,
    eth_threshold: Number(params.ethThreshold),
    is_tax_token: params.isTaxToken,
    dev_buy_fee_percent: params.devBuyFeePercent,
    dev_sell_fee_percent: params.devSellFeePercent,
    marketing_buy_fee_percent: params.marketingBuyFeePercent,
    marketing_sell_fee_percent: params.marketingSellFeePercent,
  });

  // Record initial buy trade to Supabase (appears in live feed + chart)
  if (initialBuyEthNum > 0 && launchRecord) {
    try {
      const spotPrice = tokensReceived > 0
        ? initialBuyEthNum / tokensReceived
        : initialPriceEth;

      await insertTrade({
        launch_id: launchRecord.id,
        mint_address: tokenAddress,
        wallet_address: params.creatorWallet,
        type: 'buy',
        sol_amount: 0,
        token_amount: tokensReceived,
        price_per_token: spotPrice,
        price_impact: null,
        fee_sol: null,
        tx_signature: receipt.hash,
        slot: null,
        chain: params.chainKey,
        eth_amount: initialBuyEthNum,
      });

      // Update ETH raised + volume
      await updateLaunch(launchRecord.id, {
        eth_raised: initialBuyEthNum,
        volume_sol: initialBuyEthNum,
      } as any);
    } catch (tradeErr) {
      console.warn('Failed to record initial buy trade:', tradeErr);
    }
  }

  return {
    tokenAddress,
    txHash: receipt.hash,
  };
}

