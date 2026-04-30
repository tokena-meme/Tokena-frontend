import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ConnectButton } from '../wallet/ConnectButton';
import { ChainSelector } from '../ui/ChainSelector';
import { useEvmWallet } from '../../hooks/useEvmWallet';
import { useChain } from '../../providers/ChainProvider';

const NAV_LINKS = [
  { label: 'Explore', href: '/' },
  { label: 'Trending', href: '/trending' },
  { label: 'Launch', href: '/launch/create' },
  { label: 'Profile', href: '/profile' },
  { label: 'Docs', href: '/docs' },
];

export function Header() {
  const location = useLocation();
  const { publicKey } = useWallet();
  const evmWallet = useEvmWallet();
  const { chain } = useChain();
  const [mobileOpen, setMobileOpen] = useState(false);

  const profileHref = chain === 'evm' && evmWallet.address 
    ? `/profile/${evmWallet.address}` 
    : (publicKey ? `/profile/${publicKey.toString()}` : '/profile');

  const dynamicNavLinks = NAV_LINKS.map(link => 
    link.label === 'Profile' ? { ...link, href: profileHref } : link
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-[#080808]/90 backdrop-blur-md border-b border-[#111]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 group">
              <img src="/logo.png" alt="Tokena Logo" className="w-7 h-7 rounded-lg object-contain" />
              <span className="font-display font-bold text-lg text-white tracking-tight">Tokena</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {dynamicNavLinks.map((link) => {
                const isActive = link.label === 'Profile' 
                  ? location.pathname.startsWith('/profile') 
                  : location.pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium font-ui transition-all ${
                      isActive
                        ? 'bg-[#111] text-white'
                        : 'text-[#555] hover:text-[#888] hover:bg-[#0d0d0d]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {(publicKey || evmWallet.address) && (
              <Link
                to={profileHref}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-[#555] hover:text-white hover:bg-[#111] transition-all"
                title="My Profile"
              >
                <User size={15} />
              </Link>
            )}
            <div className="hidden md:flex items-center gap-2">
              <ChainSelector compact />
              <ConnectButton />
            </div>

            <button
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-[#555] hover:text-white hover:bg-[#111] transition-all"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[#111] bg-[#080808] px-4 py-3 flex flex-col gap-1">
          {dynamicNavLinks.map((link) => {
            const isActive = link.label === 'Profile' 
              ? location.pathname.startsWith('/profile') 
              : location.pathname === link.href;
            
            return (
              <Link
                key={link.href}
                to={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium font-ui transition-all ${
                  isActive ? 'bg-[#111] text-white' : 'text-[#555]'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-[#111] mt-1 space-y-2">
            <ChainSelector />
            <ConnectButton />
          </div>
        </div>
      )}
    </header>
  );
}
