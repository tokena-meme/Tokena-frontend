import { supabase } from './client';
import type { Profile, TokenComment, Follower, ActivityItem, ProfileStats, HoldingItem } from './types';
import type { Launch, Trade } from './queries';

// ─── Profile ──────────────────────────────────────────────────

export async function getProfile(wallet: string): Promise<Profile> {
  // Try to fetch existing
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('wallet_address', wallet)
    .maybeSingle();

  if (data) return data as Profile;

  // Auto-create on first view
  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address' })
    .select()
    .single();

  if (insertError) {
    // Fallback: return a minimal profile object
    return {
      id: '',
      wallet_address: wallet,
      display_name: null,
      username: null,
      avatar_url: null,
      bio: null,
      twitter: null,
      telegram: null,
      website: null,
      is_verified: false,
      follower_count: 0,
      following_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return newProfile as Profile;
}

export async function updateProfile(
  wallet: string,
  updates: Partial<Pick<Profile, 'display_name' | 'username' | 'avatar_url' | 'bio' | 'twitter' | 'telegram' | 'website'>>
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('wallet_address', wallet)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

// ─── Follow System ────────────────────────────────────────────

export async function followUser(followerWallet: string, followingWallet: string): Promise<void> {
  const { error } = await supabase
    .from('followers')
    .insert({ follower_wallet: followerWallet, following_wallet: followingWallet });
  if (error && !error.message.includes('duplicate')) throw error;
}

export async function unfollowUser(followerWallet: string, followingWallet: string): Promise<void> {
  const { error } = await supabase
    .from('followers')
    .delete()
    .eq('follower_wallet', followerWallet)
    .eq('following_wallet', followingWallet);
  if (error) throw error;
}

export async function isFollowing(followerWallet: string, followingWallet: string): Promise<boolean> {
  const { data } = await supabase
    .from('followers')
    .select('id')
    .eq('follower_wallet', followerWallet)
    .eq('following_wallet', followingWallet)
    .maybeSingle();
  return data !== null;
}

export async function getFollowers(wallet: string, limit = 50): Promise<Follower[]> {
  const { data, error } = await supabase
    .from('followers')
    .select('*')
    .eq('following_wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Follower[];
}

export async function getFollowersWithProfiles(wallet: string, limit = 100): Promise<Profile[]> {
  const list = await getFollowers(wallet, limit);
  if (!list.length) return [];
  const wallets = list.map(f => f.follower_wallet);
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('wallet_address', wallets);
    
  if (error) throw error;
  const profiles = (data ?? []) as Profile[];
  
  // Sort to match follow order
  const walletMap = new Map(profiles.map(p => [p.wallet_address, p]));
  return wallets.map(w => walletMap.get(w)).filter((p): p is Profile => !!p);
}

export async function getFollowing(wallet: string, limit = 50): Promise<Follower[]> {
  const { data, error } = await supabase
    .from('followers')
    .select('*')
    .eq('follower_wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Follower[];
}

export async function getFollowingWithProfiles(wallet: string, limit = 100): Promise<Profile[]> {
  const list = await getFollowing(wallet, limit);
  if (!list.length) return [];
  const wallets = list.map(f => f.following_wallet);
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('wallet_address', wallets);
    
  if (error) throw error;
  const profiles = (data ?? []) as Profile[];
  
  // Sort to match follow order
  const walletMap = new Map(profiles.map(p => [p.wallet_address, p]));
  return wallets.map(w => walletMap.get(w)).filter((p): p is Profile => !!p);
}

// ─── Profile Stats ────────────────────────────────────────────

export async function getProfileStats(wallet: string): Promise<ProfileStats> {
  const [launchesRes, tradesRes] = await Promise.all([
    supabase.from('launches').select('id', { count: 'exact', head: true }).eq('creator_wallet', wallet),
    supabase.from('trades').select('sol_amount, fee_sol, type').eq('wallet_address', wallet),
  ]);

  const total_tokens_created = launchesRes.count ?? 0;
  const trades = (tradesRes.data ?? []) as Pick<Trade, 'sol_amount' | 'fee_sol' | 'type'>[];
  const total_volume_sol = trades.reduce((sum, t) => sum + Number(t.sol_amount), 0);

  // Creator earnings: fetch trades on tokens this wallet created
  const { data: creatorLaunches } = await supabase
    .from('launches')
    .select('id')
    .eq('creator_wallet', wallet);
  
  let total_creator_earnings = 0;
  if (creatorLaunches && creatorLaunches.length > 0) {
    const launchIds = creatorLaunches.map(l => l.id);
    const { data: feeTrades } = await supabase
      .from('trades')
      .select('fee_sol')
      .in('launch_id', launchIds);
    if (feeTrades) {
      total_creator_earnings = feeTrades.reduce((sum, t) => sum + Number(t.fee_sol || 0), 0) * 0.5;
    }
  }

  return { total_tokens_created, total_volume_sol, total_creator_earnings };
}

// ─── Comments ─────────────────────────────────────────────────

export async function getCommentsByMint(mint: string, limit = 100): Promise<TokenComment[]> {
  const { data, error } = await supabase
    .from('token_comments')
    .select('*')
    .eq('token_mint', mint)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const comments = (data ?? []) as TokenComment[];

  // Batch-fetch profiles for all comment wallets
  if (comments.length > 0) {
    const wallets = [...new Set(comments.map(c => c.wallet))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('wallet_address, display_name, username, avatar_url, is_verified')
      .in('wallet_address', wallets);

    const profileMap = new Map((profiles ?? []).map(p => [p.wallet_address, p]));
    comments.forEach(c => {
      c.profile = profileMap.get(c.wallet) ?? null;
    });
  }

  return comments;
}

export async function getCommentsCountByMint(mint: string): Promise<number> {
  const { count, error } = await supabase
    .from('token_comments')
    .select('id', { count: 'exact', head: true })
    .eq('token_mint', mint);
  if (error) return 0;
  return count ?? 0;
}

function sanitizeCommentText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim()
    .slice(0, 500);
}

export async function addComment(mint: string, wallet: string, text: string, parentId?: string | null): Promise<TokenComment> {
  const sanitized = sanitizeCommentText(text);
  if (!sanitized) throw new Error('Comment cannot be empty');

  const { data, error } = await supabase
    .from('token_comments')
    .insert({ token_mint: mint, wallet, text: sanitized, parent_id: parentId || null })
    .select()
    .single();

  if (error) throw error;
  return data as TokenComment;
}

export async function deleteComment(commentId: string, wallet: string): Promise<void> {
  const { error } = await supabase
    .from('token_comments')
    .delete()
    .eq('id', commentId)
    .eq('wallet', wallet); // only owner can delete
  if (error) throw error;
}

// ─── Comment Likes ────────────────────────────────────────────

export async function likeComment(commentId: string, wallet: string): Promise<void> {
  const { error } = await supabase
    .from('comment_likes')
    .insert({ comment_id: commentId, wallet });
  if (error && !error.message.includes('duplicate')) throw error;
}

export async function unlikeComment(commentId: string, wallet: string): Promise<void> {
  const { error } = await supabase
    .from('comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('wallet', wallet);
  if (error) throw error;
}

export async function getCommentLikesByUser(commentIds: string[], wallet: string): Promise<Set<string>> {
  if (!commentIds.length || !wallet) return new Set();
  const { data } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .in('comment_id', commentIds)
    .eq('wallet', wallet);
  return new Set((data ?? []).map(d => d.comment_id));
}

// ─── Favorites ────────────────────────────────────────────────

export async function toggleFavorite(wallet: string, mint: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('wallet_address', wallet)
    .eq('token_mint', mint)
    .maybeSingle();

  if (existing) {
    await supabase.from('favorites').delete().eq('id', existing.id);
    return false; // un-favorited
  } else {
    await supabase.from('favorites').insert({ wallet_address: wallet, token_mint: mint });
    return true; // favorited
  }
}

export async function isFavorited(wallet: string, mint: string): Promise<boolean> {
  if (!wallet || !mint) return false;
  const { data } = await supabase
    .from('favorites')
    .select('id')
    .eq('wallet_address', wallet)
    .eq('token_mint', mint)
    .maybeSingle();
  return !!data;
}

export async function getUserFavorites(wallet: string): Promise<string[]> {
  const { data } = await supabase
    .from('favorites')
    .select('token_mint')
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: false });
  return (data ?? []).map(f => f.token_mint);
}

// ─── Activity Feed ────────────────────────────────────────────

export async function getUserActivity(wallet: string, limit = 30): Promise<ActivityItem[]> {
  const activities: ActivityItem[] = [];

  // 1. Trades (buys and sells)
  const { data: trades } = await supabase
    .from('trades')
    .select('id, type, sol_amount, eth_amount, chain, mint_address, created_at, launch:launches(name, symbol, image_url, mint_address)')
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: false })
    .limit(limit);

  (trades ?? []).forEach((t: any) => {
    activities.push({
      id: `trade-${t.id}`,
      type: t.type === 'buy' ? 'bought_token' : 'sold_token',
      wallet,
      timestamp: t.created_at,
      metadata: {
        token_name: t.launch?.name,
        token_symbol: t.launch?.symbol,
        token_mint: t.launch?.mint_address ?? t.mint_address,
        token_image: t.launch?.image_url,
        sol_amount: Number(t.sol_amount),
        eth_amount: t.eth_amount ? Number(t.eth_amount) : undefined,
        chain: t.chain,
      },
    });
  });

  // 2. Created tokens
  const { data: launches } = await supabase
    .from('launches')
    .select('id, name, symbol, image_url, mint_address, created_at')
    .eq('creator_wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(limit);

  (launches ?? []).forEach((l: any) => {
    activities.push({
      id: `launch-${l.id}`,
      type: 'created_token',
      wallet,
      timestamp: l.created_at,
      metadata: {
        token_name: l.name,
        token_symbol: l.symbol,
        token_mint: l.mint_address,
        token_image: l.image_url,
      },
    });
  });

  // 3. Comments
  const { data: comments } = await supabase
    .from('token_comments')
    .select('id, token_mint, text, created_at')
    .eq('wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (comments && comments.length > 0) {
    // Fetch token names for comment mints
    const mints = [...new Set(comments.map(c => c.token_mint))];
    const { data: tokenInfo } = await supabase
      .from('launches')
      .select('name, symbol, image_url, mint_address')
      .in('mint_address', mints);
    const tokenMap = new Map((tokenInfo ?? []).map(t => [t.mint_address, t]));

    comments.forEach((c: any) => {
      const token = tokenMap.get(c.token_mint);
      activities.push({
        id: `comment-${c.id}`,
        type: 'commented',
        wallet,
        timestamp: c.created_at,
        metadata: {
          token_name: token?.name,
          token_symbol: token?.symbol,
          token_mint: c.token_mint,
          token_image: token?.image_url,
          comment_text: c.text,
        },
      });
    });
  }

  // 4. Follows
  const { data: follows } = await supabase
    .from('followers')
    .select('id, following_wallet, created_at')
    .eq('follower_wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(limit);

  (follows ?? []).forEach((f: any) => {
    activities.push({
      id: `follow-${f.id}`,
      type: 'followed',
      wallet,
      timestamp: f.created_at,
      metadata: {
        followed_wallet: f.following_wallet,
      },
    });
  });

  // Sort all by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return activities.slice(0, limit);
}

// ─── Holdings (computed from trade history) ───────────────────

export async function getUserHoldings(wallet: string): Promise<HoldingItem[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*, launch:launches(name, symbol, image_url, mint_address)')
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: true });

  if (error) throw error;
  const trades = (data ?? []) as (Trade & { launch: Pick<Launch, 'name' | 'symbol' | 'image_url' | 'mint_address'> | null })[];

  // Aggregate per token
  const holdingMap = new Map<string, HoldingItem>();

  trades.forEach(t => {
    const mint = t.launch?.mint_address ?? t.mint_address;
    let holding = holdingMap.get(mint);
    if (!holding) {
      holding = {
        mint_address: mint,
        token_name: t.launch?.name ?? 'Unknown',
        token_symbol: t.launch?.symbol ?? '???',
        token_image: t.launch?.image_url ?? null,
        quantity: 0,
        total_bought: 0,
        total_sold: 0,
        total_buy_sol: 0,
        total_sell_sol: 0,
        avg_buy_price: 0,
        realized_pnl: 0,
        net_quantity: 0,
      };
      holdingMap.set(mint, holding);
    }

    const amount = Number(t.token_amount);
    const sol = Number(t.sol_amount);

    if (t.type === 'buy') {
      holding.total_bought += amount;
      holding.total_buy_sol += sol;
      holding.quantity += amount;
    } else {
      holding.total_sold += amount;
      holding.total_sell_sol += sol;
      holding.quantity -= amount;
      // Realized PnL: sell revenue - proportional buy cost
      if (holding.total_bought > 0) {
        const costBasis = (holding.total_buy_sol / holding.total_bought) * amount;
        holding.realized_pnl += sol - costBasis;
      }
    }

    holding.net_quantity = Math.max(holding.quantity, 0);
    holding.avg_buy_price = holding.total_bought > 0 ? holding.total_buy_sol / holding.total_bought : 0;
  });

  return Array.from(holdingMap.values()).filter(h => h.total_bought > 0);
}

// ─── User Comments (all comments by a user across tokens) ─────

export async function getUserComments(wallet: string, limit = 30): Promise<TokenComment[]> {
  const { data, error } = await supabase
    .from('token_comments')
    .select('*')
    .eq('wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TokenComment[];
}

// ─── Realtime Subscriptions ───────────────────────────────────

export function subscribeToComments(mint: string, onComment: (comment: TokenComment) => void) {
  return supabase
    .channel(`comments:${mint}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'token_comments',
      filter: `token_mint=eq.${mint}`,
    }, async (payload) => {
      const comment = payload.new as TokenComment;
      // Fetch profile for the commenter
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url, is_verified')
        .eq('wallet_address', comment.wallet)
        .maybeSingle();
      comment.profile = profile ?? null;
      onComment(comment);
    })
    .subscribe();
}

export function subscribeToCommentDeletes(mint: string, onDelete: (commentId: string) => void) {
  return supabase
    .channel(`comments_delete:${mint}`)
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'token_comments',
      filter: `token_mint=eq.${mint}`,
    }, (payload) => {
      onDelete((payload.old as any).id);
    })
    .subscribe();
}

export function subscribeToProfileUpdates(wallet: string, onUpdate: (profile: Profile) => void) {
  return supabase
    .channel(`profile:${wallet}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles',
      filter: `wallet_address=eq.${wallet}`,
    }, (payload) => onUpdate(payload.new as Profile))
    .subscribe();
}
