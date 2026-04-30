import { getMcapUsd } from '../utils/marketcap';

export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export const INTERVAL_MS: Record<Interval, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

export interface RawTrade {
  created_at: string;
  type: 'buy' | 'sell';
  sol_amount: number;
  token_amount: number;
  mcap_usd: number;     // stored value — primary source
  sol_raised_after: number;     // fallback for computing mcap
  eth_amount?: number;
}

export interface McapCandle {
  time: number;    // Unix seconds (TradingView format)
  open: number;    // USD
  high: number;    // USD
  low: number;     // USD
  close: number;   // USD
  volume: number;  // SOL volume in this candle
  buyVolume: number;
  sellVolume: number;
  tradeCount: number;
  isBullish: boolean;   // close >= open
}

/**
 * Build OHLCV candles where every OHLC value is the USD market cap
 * at the moment of each trade.
 */
export function buildMcapCandles(
  trades: Omit<RawTrade, 'mcap_usd' | 'sol_raised_after'>[] & any,
  interval: Interval,
  solPriceUsd: number,
  isEvm?: boolean,
  totalSupply?: number
): McapCandle[] {
  if (!trades.length) return [];

  // Sort oldest → newest
  const sorted = [...trades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const ms = INTERVAL_MS[interval];

  type Bucket = {
    open: number; high: number; low: number; close: number;
    volume: number; buyVolume: number; sellVolume: number;
    tradeCount: number;
  };

  const map = new Map<number, Bucket>();

  for (const trade of sorted) {
    const ts = new Date(trade.created_at).getTime();
    const bucket = Math.floor(ts / ms) * ms;

    // Resolve mcap_usd — use stored value first, compute as fallback
    const mcap = trade.mcap_usd && trade.mcap_usd > 0
        ? Number(trade.mcap_usd)
        : (isEvm && totalSupply
            ? (Number(trade.price_per_token) * totalSupply * solPriceUsd)
            : getMcapUsd(Number(trade.sol_raised_after || 0), solPriceUsd));

    const solAmount = Number((trade as any).eth_amount || trade.sol_amount || 0);

    const existing = map.get(bucket);
    if (!existing) {
      map.set(bucket, {
        open: mcap,
        high: mcap,
        low: mcap,
        close: mcap,
        volume: solAmount,
        buyVolume: trade.type === 'buy' ? solAmount : 0,
        sellVolume: trade.type === 'sell' ? solAmount : 0,
        tradeCount: 1,
      });
    } else {
      existing.high = Math.max(existing.high, mcap);
      existing.low = Math.min(existing.low, mcap);
      existing.close = mcap;                    // last trade = close
      existing.volume += solAmount;
      existing.tradeCount += 1;
      if (trade.type === 'buy') existing.buyVolume += solAmount;
      if (trade.type === 'sell') existing.sellVolume += solAmount;
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, b]) => ({
      time: Math.floor(time / 1000),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      buyVolume: b.buyVolume,
      sellVolume: b.sellVolume,
      tradeCount: b.tradeCount,
      isBullish: b.close >= b.open,
    }));
}

/**
 * Seed candle for a brand-new token with no trades yet.
 * Shows the launch mcap as a flat candle so the chart is not empty.
 */
export function buildLaunchCandle(
  launchCreatedAt: Date,
  solPriceUsd: number,
  overrideLaunchMcap?: number
): McapCandle {
  const mcap = overrideLaunchMcap ?? getMcapUsd(0, solPriceUsd);
  return {
    time: Math.floor(launchCreatedAt.getTime() / 1000),
    open: mcap,
    high: mcap,
    low: mcap,
    close: mcap,
    volume: 0,
    buyVolume: 0,
    sellVolume: 0,
    tradeCount: 0,
    isBullish: true,
  };
}

/**
 * Append a live trade tick to the candles array without a full reload.
 * Call this from your Supabase Realtime subscription.
 */
export function appendTick(
  candles: McapCandle[],
  trade: Omit<RawTrade, 'mcap_usd' | 'sol_raised_after'>[] & any,
  interval: Interval,
  solPriceUsd: number,
  isEvm?: boolean,
  totalSupply?: number
): McapCandle[] {
  const ts = new Date(trade.created_at).getTime();
  const ms = INTERVAL_MS[interval];
  const bucket = Math.floor(ts / ms) * ms;
  const time = Math.floor(bucket / 1000);

  const mcap = trade.mcap_usd && trade.mcap_usd > 0
      ? Number(trade.mcap_usd)
      : (isEvm && totalSupply
          ? (Number(trade.price_per_token) * totalSupply * solPriceUsd)
          : getMcapUsd(Number(trade.sol_raised_after || 0), solPriceUsd));

  const solAmount = Number((trade as any).eth_amount || trade.sol_amount || 0);
  const last = candles[candles.length - 1];

  if (last && last.time === time) {
    // Update current open candle
    const updated: McapCandle = {
      ...last,
      high: Math.max(last.high, mcap),
      low: Math.min(last.low, mcap),
      close: mcap,
      volume: last.volume + solAmount,
      buyVolume: last.buyVolume + (trade.type === 'buy' ? solAmount : 0),
      sellVolume: last.sellVolume + (trade.type === 'sell' ? solAmount : 0),
      tradeCount: last.tradeCount + 1,
      isBullish: mcap >= last.open,
    };
    return [...candles.slice(0, -1), updated];
  }

  // New interval — open new candle, open = last close
  return [
    ...candles,
    {
      time,
      open: last?.close ?? mcap,
      high: mcap,
      low: mcap,
      close: mcap,
      volume: solAmount,
      buyVolume: trade.type === 'buy' ? solAmount : 0,
      sellVolume: trade.type === 'sell' ? solAmount : 0,
      tradeCount: 1,
      isBullish: mcap >= (last?.close ?? mcap),
    },
  ];
}
