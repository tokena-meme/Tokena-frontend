
import { supabase } from './client';

export async function upsertUser(walletAddress: string) {
  try {
    const { error } = await supabase
      .from('users')
      .upsert(
        { wallet_address: walletAddress },
        { onConflict: 'wallet_address' }
      );
    if (error) {
      // Non-critical: table may not exist yet, silently ignore
      console.warn('upsertUser: table may not exist yet —', error.message);
    }
  } catch {
    // Silently handle — user table is optional
  }
}

export type Launch = {
  id: string;
  creator_wallet: string;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  metadata_uri?: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  mint_address: string;
  dbc_pool_address: string | null;
  meteora_pool_address: string | null;
  status: 'active' | 'migrated' | 'failed';
  total_supply: number;
  initial_price_sol: number;
  migration_threshold_sol: number;
  sol_raised: number;
  migration_progress: number;
  is_migrated: boolean;
  migrated_at: string | null;
  volume_sol?: number;
  ath_mcap_usd?: number;
  is_featured: boolean;
  is_nsfw: boolean;
  creator_fee_percent: number;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
  creator_profile?: {
    display_name: string | null;
    username: string | null;
  } | null;
  // EVM fields
  chain?: string; // 'solana' | 'ethereum' | 'bsc' | 'base' | 'arbitrum'
  token_address?: string | null;
  eth_threshold?: number | null;
  eth_raised?: number | null;
  is_tax_token?: boolean;
  dev_buy_fee_percent?: number;
  dev_sell_fee_percent?: number;
  marketing_buy_fee_percent?: number;
  marketing_sell_fee_percent?: number;
  favorites_count?: number;
};


export type Trade = {
  id: string;
  launch_id: string;
  mint_address: string;
  wallet_address: string;
  type: 'buy' | 'sell';
  sol_amount: number;
  token_amount: number;
  price_per_token: number;
  price_impact: number | null;
  fee_sol: number | null;
  tx_signature: string;
  slot: number | null;
  sol_raised_after?: number | null;
  mcap_usd?: number | null;
  token_price_usd?: number | null;
  created_at: string;
  // EVM fields
  chain?: string;
  eth_amount?: number | null;
};

export async function getLaunches(options?: {
  limit?: number;
  status?: 'active' | 'migrated';
  orderBy?: 'created_at' | 'sol_raised' | 'migration_progress';
  chain?: string; // filter by chain, omit for all chains
}): Promise<Launch[]> {
  let query = supabase
    .from('launches')
    .select('*')
    .eq('is_banned', false)
    .order(options?.orderBy ?? 'created_at', { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.chain) {
    query = query.eq('chain', options.chain);
  }

  const { data, error } = await query;
  if (error) throw error;
  const launches = (data ?? []) as Launch[];

  // Attach profiles manually to avoid PGRST200 (missing relationship) errors
  if (launches.length > 0) {
    const wallets = [...new Set(launches.map(l => l.creator_wallet))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('wallet_address, display_name, username')
      .in('wallet_address', wallets);

    const profileMap = new Map((profiles ?? []).map(p => [p.wallet_address, p]));
    launches.forEach(l => {
      const p = profileMap.get(l.creator_wallet);
      if (p) {
        l.creator_profile = { display_name: p.display_name, username: p.username };
      }
    });
  }

  return launches;
}

/** Fetch ALL EVM launches (non-solana) so the fee hook can check pendingFees for any wallet */
export async function getAllEvmLaunches(): Promise<Launch[]> {
  const { data, error } = await supabase
    .from('launches')
    .select('*')
    .eq('is_banned', false)
    .neq('chain', 'solana')
    .not('chain', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data ?? []) as Launch[];
}

export async function getLaunchByMint(mintAddress: string): Promise<Launch | null> {
  const { data, error } = await supabase
    .from('launches')
    .select('*')
    .eq('mint_address', mintAddress)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const launch = data as Launch;
  // Attach profile manually
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('wallet_address', launch.creator_wallet)
    .maybeSingle();

  if (profile) {
    launch.creator_profile = { display_name: profile.display_name, username: profile.username };
  }

  return launch;
}

export async function getLaunchesByMints(mintAddresses: string[]): Promise<Launch[]> {
  if (!mintAddresses.length) return [];
  
  const { data, error } = await supabase
    .from('launches')
    .select('*')
    .in('mint_address', mintAddresses)
    .eq('is_banned', false);

  if (error) throw error;
  const launches = (data ?? []) as Launch[];

  // Attach profiles manually
  if (launches.length > 0) {
    const wallets = [...new Set(launches.map(l => l.creator_wallet))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('wallet_address, display_name, username')
      .in('wallet_address', wallets);

    const profileMap = new Map((profiles ?? []).map(p => [p.wallet_address, p]));
    launches.forEach(l => {
      const p = profileMap.get(l.creator_wallet);
      if (p) {
        l.creator_profile = { display_name: p.display_name, username: p.username };
      }
    });
  }

  // Preserve the order of mintAddresses if possible, or just return as is
  return launches;
}

export async function createLaunch(launch: Omit<Launch, 'id' | 'created_at' | 'updated_at' | 'sol_raised' | 'migration_progress' | 'is_migrated' | 'migrated_at' | 'is_featured' | 'is_nsfw' | 'is_banned' | 'status' | 'meteora_pool_address'>): Promise<Launch> {
  const { data, error } = await supabase
    .from('launches')
    .insert(launch)
    .select()
    .single();
  if (error) throw error;
  return data as Launch;
}

export async function getTradesByMint(mintAddress: string, limit = 100): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('mint_address', mintAddress)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Trade[];
}

export async function getRecentTradesByMint(mintAddress: string, limit = 30): Promise<Trade[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('mint_address', mintAddress)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Trade[];
}

export async function getLatestGlobalTrade(): Promise<(Trade & { launch: Pick<Launch, 'name' | 'symbol' | 'image_url' | 'mint_address' | 'status'> | null }) | null> {
  const { data, error } = await supabase
    .from('trades')
    .select('*, launch:launches(name, symbol, image_url, mint_address, status)')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as any;
}

export async function insertTrade(trade: Omit<Trade, 'id' | 'created_at'>): Promise<Trade> {
  const { data, error } = await supabase
    .from('trades')
    .insert(trade)
    .select()
    .single();
  if (error) throw error;
  return data as Trade;
}

export async function updateLaunch(launchId: string, updates: Partial<Launch>): Promise<void> {
  const { error } = await supabase
    .from('launches')
    .update(updates)
    .eq('id', launchId);
  if (error) throw error;
}

export async function getCreatorEarnedFees(walletAddress: string): Promise<number> {
  const { data: launches, error: launchError } = await supabase
    .from('launches')
    .select('id')
    .eq('creator_wallet', walletAddress);

  if (launchError || !launches || launches.length === 0) return 0;

  const launchIds = launches.map((l) => l.id);

  const { data: trades, error: tradeError } = await supabase
    .from('trades')
    .select('fee_sol')
    .in('launch_id', launchIds);

  if (tradeError || !trades) return 0;

  const totalFees = trades.reduce((sum, t) => sum + Number(t.fee_sol || 0), 0);
  return totalFees * 0.5; // Creator receives exactly 50% split natively
}


export async function getPlatformStats() {
  const [launchesRes, tradesRes, migratedRes] = await Promise.all([
    supabase.from('launches').select('id', { count: 'exact', head: true }),
    supabase.from('trades').select('sol_amount'),
    supabase.from('launches').select('id', { count: 'exact', head: true }).eq('is_migrated', true),
  ]);

  const totalVolume = ((tradesRes.data ?? []) as Trade[]).reduce((sum, t) => sum + Number(t.sol_amount), 0);

  return {
    totalLaunches: launchesRes.count ?? 0,
    totalVolumeSol: totalVolume,
    totalMigrations: migratedRes.count ?? 0,
  };
}

export function subscribeToTrades(mintAddress: string, onTrade: (trade: Trade) => void) {
  return supabase
    .channel(`trades:${mintAddress}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'trades',
      filter: `mint_address=eq.${mintAddress}`,
    }, (payload) => onTrade(payload.new as Trade))
    .subscribe();
}

export function subscribeToLaunchUpdates(mintAddress: string, onUpdate: (launch: Launch) => void) {
  return supabase
    .channel(`launch:${mintAddress}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'launches',
      filter: `mint_address=eq.${mintAddress}`,
    }, (payload) => onUpdate(payload.new as Launch))
    .subscribe();
}

export function subscribeToAllLaunches(onLaunch: (launch: Launch) => void) {
  return supabase
    .channel('global:launches')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'launches',
    }, (payload) => onLaunch(payload.new as Launch))
    .subscribe((status) => {
      console.log('Realtime [global:launches] status:', status);
    });
}

export function subscribeToAllTrades(onTrade: (trade: Trade & { launch?: Pick<Launch, 'name' | 'symbol' | 'image_url' | 'mint_address' | 'status'> | null }) => void) {
  return supabase
    .channel('global:trades')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'trades',
    }, async (payload) => {
      const newTrade = payload.new as Trade;
      // Fetch the token details natively to display on the global feed
      const { data } = await supabase.from('launches').select('*').eq('mint_address', newTrade.mint_address).single();
      if (data) {
        const launch = data as Launch;
        const { data: profile } = await supabase.from('profiles').select('display_name, username').eq('wallet_address', launch.creator_wallet).maybeSingle();
        if (profile) {
          launch.creator_profile = { display_name: profile.display_name, username: profile.username };
        }
        onTrade({ ...newTrade, launch });
      } else {
        onTrade({ ...newTrade, launch: undefined });
      }
    })
    .subscribe((status) => {
      console.log('Realtime [global:trades] status:', status);
    });
}

export function subscribeToUserTrades(walletAddress: string, onTrade: (trade: Trade & { launch?: Pick<Launch, 'name' | 'symbol' | 'image_url' | 'mint_address' | 'status'> | null }) => void) {
  return supabase
    .channel(`user_trades:${walletAddress}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'trades',
      filter: `wallet_address=eq.${walletAddress}`,
    }, async (payload) => {
      const newTrade = payload.new as Trade;
      const { data } = await supabase.from('launches').select('*').eq('mint_address', newTrade.mint_address).single();
      if (data) {
        const launch = data as Launch;
        const { data: profile } = await supabase.from('profiles').select('display_name, username').eq('wallet_address', launch.creator_wallet).maybeSingle();
        if (profile) {
          launch.creator_profile = { display_name: profile.display_name, username: profile.username };
        }
        onTrade({ ...newTrade, launch });
      } else {
        onTrade({ ...newTrade, launch: undefined });
      }
    })
    .subscribe((status) => {
      console.log(`Realtime [user_trades:${walletAddress}] status:`, status);
    });
}

export async function getUserTrades(walletAddress: string): Promise<(Trade & { launch: Pick<Launch, 'name' | 'symbol' | 'image_url' | 'mint_address' | 'status'> | null })[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*, launch:launches(name, symbol, image_url, mint_address, status)')
    .eq('wallet_address', walletAddress)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as (Trade & { launch: Pick<Launch, 'name' | 'symbol' | 'image_url' | 'mint_address' | 'status'> | null })[];
}

export async function getUserLaunches(walletAddress: string): Promise<Launch[]> {
  const { data, error } = await supabase
    .from('launches')
    .select('*')
    .eq('creator_wallet', walletAddress)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const launches = (data ?? []) as Launch[];

  if (launches.length > 0) {
    const { data: p } = await supabase.from('profiles').select('display_name, username').eq('wallet_address', walletAddress).maybeSingle();
    if (p) {
      launches.forEach(l => {
        l.creator_profile = { display_name: p.display_name, username: p.username };
      });
    }
  }

  return launches;
}

/**
 * Fetch all launches with 0% creator fee.
 * These tokens have the platform wallet as feeClaimer,
 * so only the platform wallet can claim their accumulated 1% fees.
 */
export async function getZeroFeeLaunches(): Promise<Launch[]> {
  const { data, error } = await supabase
    .from('launches')
    .select('*')
    .eq('creator_fee_percent', 0)
    .not('dbc_pool_address', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const launches = (data ?? []) as Launch[];

  if (launches.length > 0) {
    const wallets = [...new Set(launches.map(l => l.creator_wallet))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('wallet_address, display_name, username')
      .in('wallet_address', wallets);

    const profileMap = new Map((profiles ?? []).map(p => [p.wallet_address, p]));
    launches.forEach(l => {
      const p = profileMap.get(l.creator_wallet);
      if (p) {
        l.creator_profile = { display_name: p.display_name, username: p.username };
      }
    });
  }

  return launches;
}

export function tradesToCandlesticks(trades: Trade[], intervalMinutes = 5, multiplier = 1) {
  if (!trades.length) return [];

  const buckets = new Map<number, { open: number; high: number; low: number; close: number }>();
  const intervalMs = intervalMinutes * 60 * 1000;

  trades.forEach((trade) => {
    const ts = new Date(trade.created_at).getTime();
    const bucket = Math.floor(ts / intervalMs) * intervalMs;
    const price = Number(trade.price_per_token) * multiplier;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, { open: price, high: price, low: price, close: price });
    } else {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
    }
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, ohlcv]) => ({
      time: Math.floor(time / 1000) as number,
      open: ohlcv.open,
      high: ohlcv.high,
      low: ohlcv.low,
      close: ohlcv.close,
    }));
}
