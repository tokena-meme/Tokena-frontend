export interface Profile {
  id: string;
  wallet_address: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
}

export interface Follower {
  id: string;
  follower_wallet: string;
  following_wallet: string;
  created_at: string;
}

export interface TokenComment {
  id: string;
  token_mint: string;
  wallet: string;
  text: string;
  likes_count: number;
  parent_id?: string | null;
  created_at: string;
  // Joined fields (optional, populated client-side)
  profile?: Pick<Profile, 'display_name' | 'username' | 'avatar_url' | 'is_verified'> | null;
  is_liked?: boolean;
}

export interface CommentLike {
  id: string;
  comment_id: string;
  wallet: string;
  created_at: string;
}

export type ActivityType = 'created_token' | 'bought_token' | 'sold_token' | 'commented' | 'followed' | 'favorited_token';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  wallet: string;
  timestamp: string;
  metadata: {
    // For token actions
    token_name?: string;
    token_symbol?: string;
    token_mint?: string;
    token_image?: string;
    sol_amount?: number;
    // For follow actions
    followed_wallet?: string;
    // For comments
    comment_text?: string;
  };
}

export interface ProfileStats {
  total_tokens_created: number;
  total_volume_sol: number;
  total_creator_earnings: number;
}

export interface HoldingItem {
  mint_address: string;
  token_name: string;
  token_symbol: string;
  token_image: string | null;
  quantity: number;
  total_bought: number;
  total_sold: number;
  total_buy_sol: number;
  total_sell_sol: number;
  avg_buy_price: number;
  realized_pnl: number;
  net_quantity: number;
}

export interface Favorite {
  id: string;
  wallet_address: string;
  token_mint: string;
  created_at: string;
}
