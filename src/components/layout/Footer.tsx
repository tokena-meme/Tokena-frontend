import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';


export function Footer() {
  return (
    <footer className="border-t border-[#111] bg-[#080808] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Tokena Logo" className="w-6 h-6 rounded-md object-contain" />
              <span className="font-display font-bold text-white">Tokena</span>
            </Link>

          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 text-xs font-mono text-[#444]">
              <Link to="/" className="hover:text-[#888] transition-colors">Explore</Link>
              <Link to="/trending" className="hover:text-[#888] transition-colors">Trending</Link>
              <Link to="/launch/create" className="hover:text-[#888] transition-colors">Launch</Link>
              <Link to="/profile" className="hover:text-[#888] transition-colors">Profile</Link>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://x.com/" className="w-7 h-7 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white hover:border-[#2a2a2a] transition-all">
                <svg viewBox="0 0 24 24" className="w-[12px] h-[12px] fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="https://github.com/tokena-meme" target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white hover:border-[#2a2a2a] transition-all">
                <Github size={12} />
              </a>
              {/* <a href="#" className="w-7 h-7 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white hover:border-[#2a2a2a] transition-all">
                <Send size={12} />
              </a> */}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#111] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#333] font-mono">
            © 2026 Tokena. Open-Source EVM Bonding Curve Launchpad.
          </p>

        </div>
      </div>
    </footer>
  );
}
