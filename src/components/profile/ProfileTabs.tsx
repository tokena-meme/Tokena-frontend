import { Coins, Wallet, Activity, MessageCircle, History, Download, Star } from 'lucide-react';

export type ProfileTab = 'created' | 'holdings' | 'activity' | 'comments' | 'trades' | 'fees' | 'favorites';

interface ProfileTabsProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  isOwner?: boolean;
  counts?: {
    created?: number;
    holdings?: number;
    activity?: number;
    comments?: number;
    trades?: number;
    favorites?: number;
  };
}

const BASE_TABS: { id: ProfileTab; label: string; icon: typeof Coins; ownerOnly?: boolean }[] = [
  { id: 'created', label: 'Created Tokens', icon: Coins },
  { id: 'holdings', label: 'Holdings', icon: Wallet },
  { id: 'trades', label: 'Trade History', icon: History, ownerOnly: true },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'fees', label: 'Claim Fees', icon: Download, ownerOnly: true },
  { id: 'comments', label: 'Comments', icon: MessageCircle },
  { id: 'favorites', label: 'Favorites', icon: Star },
];

export function ProfileTabs({ activeTab, onTabChange, isOwner, counts }: ProfileTabsProps) {
  const tabs = BASE_TABS.filter(t => !t.ownerOnly || isOwner);

  return (
    <div className="flex gap-1 border-b border-[#111] overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => {
        const count = counts?.[tab.id as keyof typeof counts];
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium font-ui transition-all border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'border-[#F5A623] text-white'
                : 'border-transparent text-[#555] hover:text-[#888]'
            }`}
          >
            <Icon size={13} />
            {tab.label}
            {count !== undefined && count > 0 && (
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded-md ${
                activeTab === tab.id ? 'bg-[#F5A623]/10 text-[#F5A623]' : 'bg-[#111] text-[#555]'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
