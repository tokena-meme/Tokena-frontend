import { useState } from 'react';
import { Book, Code, Zap, Shield, Rocket } from 'lucide-react';

const DOCS_SECTIONS = [
  { id: 'introduction', label: 'Introduction', icon: Book },
  { id: 'launching', label: 'Launching a Token', icon: Rocket },
  { id: 'trading', label: 'Trading & Fees', icon: Zap },
  { id: 'smart-contracts', label: 'Bonding Curve', icon: Code },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'open-source', label: 'Open Source', icon: Code },
];

export function Docs() {
  const [activeSection, setActiveSection] = useState('introduction');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-white mb-2">Documentation</h1>
        <p className="text-[#888] font-mono text-sm max-w-2xl">
          Learn how to launch tokens, trade, and understand the mechanics behind Tokena's dynamic bonding curve launches.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-4 md:pb-0 scrollbar-hide">
            {DOCS_SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all whitespace-nowrap min-w-max md:min-w-0 ${
                    activeSection === section.id
                      ? 'bg-[#111] border border-[#222] text-white'
                      : 'text-[#555] hover:text-[#888] hover:bg-[#0d0d0d] border border-transparent'
                  }`}
                >
                  <Icon size={18} className={activeSection === section.id ? 'text-[#F5A623]' : ''} />
                  <span className="font-ui font-medium text-sm">{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-6 md:p-8 min-h-[500px]">
          {activeSection === 'introduction' && (
            <div className="space-y-6 text-[#888] font-mono text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-2xl font-display font-bold text-white mb-4">Welcome to Tokena</h2>
              <p>
                Tokena is an open-source decentralized token launchpad built on EVM-compatible blockchains. Our smart contracts use bonding curve mathematics to ensure completely fair launches with immediate liquidity — no presales, no team allocations. When a token reaches its ETH threshold, it auto-migrates to Uniswap.
              </p>
              <p>
                Tokena is fully open-source. Anyone can use our EVM smart contracts to deploy their own launchpad, integrate with the <a href="https://www.npmjs.com/package/@tokena/sdk" target="_blank" rel="noopener noreferrer" className="text-[#F5A623] hover:underline">Tokena SDK</a> for faster development, or clone the <a href="https://github.com/nicejudy/tokena-frontend" target="_blank" rel="noopener noreferrer" className="text-[#F5A623] hover:underline">Tokena frontend from GitHub</a>.
              </p>
              <div className="p-5 bg-[#111] rounded-xl border border-[#222] shadow-inner mt-6">
                <h3 className="text-white font-ui font-bold mb-3 flex items-center gap-2">
                  <Zap size={16} className="text-[#F5A623]" /> Key Platform Features
                </h3>
                <ul className="list-disc pl-5 space-y-2 text-[#aaa]">
                  <li><strong className="text-[#ccc]">Instant Token Launches:</strong> Deploy a bonding curve token on any EVM chain in seconds.</li>
                  <li><strong className="text-[#ccc]">Fair Launch Mechanics:</strong> No presales, no team allocations — all supply starts on the bonding curve.</li>
                  <li><strong className="text-[#ccc]">Automated Migration:</strong> Tokens auto-migrate to Uniswap when the ETH threshold is reached.</li>
                  <li><strong className="text-[#ccc]">Creator Revenue:</strong> Earn trading fees from every buy and sell on your launched tokens.</li>
                  <li><strong className="text-[#ccc]">Open-Source SDK:</strong> Build your own launchpad with <code className="bg-[#222] px-1.5 py-0.5 rounded text-xs text-white">@tokena/sdk</code> — React hooks, trade simulation, and more.</li>
                  <li><strong className="text-[#ccc]">Fully Open-Source:</strong> Smart contracts, SDK, and frontend are all available on GitHub.</li>
                </ul>
              </div>
            </div>
          )}

          {activeSection === 'launching' && (
            <div className="space-y-6 text-[#888] font-mono text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-2xl font-display font-bold text-white mb-4">Launching a Token</h2>
              <p>
                Launching a token on Tokena is designed to be frictionless, taking less than a minute from start to finish. You only need to provide basic metadata such as a name, ticker symbol, description, and a logo or image.
              </p>
              
              <h3 className="text-lg font-display font-bold text-white mt-8 mb-3">The Launch Process</h3>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-xs text-white font-bold">1</div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Connect Wallet</h4>
                    <p>Connect your EVM wallet (e.g., MetaMask, Rabby). Ensure you have enough ETH for the small deployment fee.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-xs text-white font-bold">2</div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Fill out the Launch Form</h4>
                    <p>Navigate to the Launch page and completely fill out your token's unique identity details. Images will be automatically uploaded to IPFS.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-xs text-white font-bold">3</div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Deploy to the Blockchain</h4>
                    <p>Pay the minimal deployment fee. The smart contract automatically deploys your bonding curve token with the configured supply, threshold, and tax settings.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-[#F5A623] to-[#FF6B35] flex items-center justify-center text-xs text-black font-bold">4</div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Live for Trading</h4>
                    <p>Your token is instantly live, indexed in our global trade feed, and available for trading on the bonding curve!</p>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {activeSection === 'trading' && (
            <div className="space-y-6 text-[#888] font-mono text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-2xl font-display font-bold text-white mb-4">Trading & Fees</h2>
              <p>
                Tokens launched on Tokena are traded directly against a mathematical bonding curve until they reach a predetermined ETH threshold. All trades are instantly settled on-chain.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <div className="bg-[#111] border border-[#222] p-5 rounded-xl">
                  <div className="text-white font-bold text-lg mb-2">Creation Fee</div>
                  <div className="text-3xl font-mono text-[#F5A623] mb-2">One-time</div>
                  <p className="text-xs text-[#777]">A small, one-time ETH fee is required to deploy your token and bonding curve. This fee supports the platform and covers initial indexing.</p>
                </div>

                <div className="bg-[#111] border border-[#222] p-5 rounded-xl">
                  <div className="text-white font-bold text-lg mb-2">Standard Token Fee</div>
                  <div className="text-3xl font-mono text-[#00D4AA] mb-2">0.4%</div>
                  <p className="text-xs text-[#777]">For tokens without custom taxes, a flat 0.4% fee is applied to all trades — split equally between you (the creator) and the platform (0.2% each).</p>
                </div>
                
                <div className="bg-[#111] border border-[#222] p-5 rounded-xl">
                  <div className="text-white font-bold text-lg mb-2">Tax Token Options</div>
                  <div className="text-3xl font-mono text-[#F5A623] mb-2">Custom</div>
                  <p className="text-xs text-[#777]">Creators can set custom Dev and Marketing taxes (up to 50% max). These fees accumulate on-chain from every trade and can be claimed from your Profile.</p>
                </div>

                <div className="bg-[#111] border border-[#222] p-5 rounded-xl">
                  <div className="text-white font-bold text-lg mb-2">Platform Revenue Share</div>
                  <div className="text-3xl font-mono text-[#00D4AA] mb-2">Cut from Tax</div>
                  <p className="text-xs text-[#777]">For tax tokens, the platform takes a percentage cut from the creator's defined tax. This ensures the platform remains sustainable while allowing high creator earnings.</p>
                </div>

                <div className="bg-[#111] border border-[#222] p-5 rounded-xl md:col-span-2">
                  <div className="text-white font-bold text-lg mb-2">How to Claim Fees</div>
                  <p className="text-xs text-[#777]">Unlike other platforms, Tokena fees are held securely on-chain in the BondingCurve contract. To receive your ETH, navigate to your Profile and click "Claim" on your tokens. This saves gas and gives you full control over your earnings.</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'smart-contracts' && (
            <div className="space-y-6 text-[#888] font-mono text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-2xl font-display font-bold text-white mb-4">Bonding Curve Architecture</h2>
              <p>
                All launches on Tokena use open-source EVM smart contracts that implement a mathematical bonding curve. The contracts are deployed via the TokenFactory and each token gets its own BondingCurve contract.
              </p>
              <p>
                A bonding curve is a mathematical concept used to describe the relationship between price and the supply of an asset. The contract guarantees that tokens are mintable and burnable strictly according to this curve, guaranteeing a continuous base price for every token in circulation without the need for a fragmented liquidity pool initially.
              </p>
              
              <div className="mt-8 p-6 bg-[#111] border border-[#222] rounded-xl flex items-center gap-4">
                 <Shield size={32} className="text-[#F5A623] flex-shrink-0" />
                 <div>
                   <h4 className="text-white font-bold mb-1">Open-Source Smart Contracts</h4>
                   <p className="text-xs text-[#777]">Tokena's EVM smart contracts are fully open-source. Anyone can audit, fork, and deploy their own launchpad using the same battle-tested bonding curve math, overflow protection, and error handling.</p>
                 </div>
              </div>

              <div className="mt-4 p-6 bg-[#111] border border-[#222] rounded-xl flex items-center gap-4">
                 <Code size={32} className="text-[#00D4AA] flex-shrink-0" />
                 <div>
                   <h4 className="text-white font-bold mb-1">Tokena SDK</h4>
                   <p className="text-xs text-[#777]">Use <code className="bg-[#222] px-1.5 py-0.5 rounded text-white">npm install @tokena/sdk</code> to integrate bonding curve trading, token discovery, trade simulation, and 15+ React hooks into your own application.</p>
                 </div>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="space-y-6 text-[#888] font-mono text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-2xl font-display font-bold text-white mb-4">Platform Security</h2>
              <p>
                Security is our absolute highest priority. The Tokena platform architecture inherently eliminates common vectors for rug-pulls, honeypots, and token scams by enforcing strict on-chain rules.
              </p>
              
              <div className="space-y-4 mt-6">
                <div className="border-l-2 border-[#00D4AA] pl-4 py-1">
                  <h4 className="text-white font-medium">No Team Allocations</h4>
                  <p className="text-xs text-[#777] mt-1">Creators cannot silently mint tokens to themselves. All supply starts on the curve.</p>
                </div>
                
                <div className="border-l-2 border-[#00D4AA] pl-4 py-1">
                  <h4 className="text-white font-medium">Auto-Revoked Authorities</h4>
                  <p className="text-xs text-[#777] mt-1">During launch, the smart contract automatically revokes the mint and freeze authorities. The token cannot be altered or frozen.</p>
                </div>
                
                <div className="border-l-2 border-[#00D4AA] pl-4 py-1">
                  <h4 className="text-white font-medium">Guaranteed Liquidity Lock</h4>
                  <p className="text-xs text-[#777] mt-1">When the ETH threshold is met, all ETH collected in the bonding curve is automatically migrated alongside the remaining tokens to Uniswap, and the LP tokens are permanently locked.</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'open-source' && (
            <div className="space-y-6 text-[#888] font-mono text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-2xl font-display font-bold text-white mb-4">Open Source</h2>
              <p>
                Tokena is fully open-source. Our mission is to make token launches accessible to everyone. You can use our smart contracts, SDK, and frontend to build your own launchpad — no permission needed.
              </p>

              <div className="space-y-4 mt-6">
                <div className="p-5 bg-[#111] rounded-xl border border-[#222]">
                  <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                    <Code size={16} className="text-[#F5A623]" /> Smart Contracts
                  </h3>
                  <p className="text-xs text-[#777] mb-3">Deploy Tokena's EVM bonding curve contracts on any EVM-compatible chain. Includes TokenFactory and BondingCurve contracts with built-in fee splitting, tax support, and auto-migration to Uniswap.</p>
                  <a href="https://github.com/nicejudy/tokena-contracts" target="_blank" rel="noopener noreferrer" className="text-[#F5A623] text-xs hover:underline">View on GitHub →</a>
                </div>

                <div className="p-5 bg-[#111] rounded-xl border border-[#222]">
                  <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                    <Zap size={16} className="text-[#00D4AA]" /> Tokena SDK
                  </h3>
                  <p className="text-xs text-[#777] mb-3">A complete TypeScript SDK for interacting with Tokena smart contracts. Includes trade simulation, token discovery, event indexing, 15+ React hooks, and typed error handling.</p>
                  <div className="bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 font-mono text-xs text-white mb-3">
                    npm install @tokena/sdk
                  </div>
                  <a href="https://www.npmjs.com/package/@tokena/sdk" target="_blank" rel="noopener noreferrer" className="text-[#00D4AA] text-xs hover:underline">View on npm →</a>
                </div>

                <div className="p-5 bg-[#111] rounded-xl border border-[#222]">
                  <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                    <Rocket size={16} className="text-[#FF6B35]" /> Frontend
                  </h3>
                  <p className="text-xs text-[#777] mb-3">Clone and customize the Tokena frontend — a production-ready React launchpad app with wallet connection, real-time trading, charts, portfolio management, and more.</p>
                  <a href="https://github.com/nicejudy/tokena-frontend" target="_blank" rel="noopener noreferrer" className="text-[#FF6B35] text-xs hover:underline">Clone from GitHub →</a>
                </div>
              </div>

              <div className="p-5 bg-gradient-to-r from-[#F5A623]/5 to-[#00D4AA]/5 rounded-xl border border-[#222] mt-6">
                <h3 className="text-white font-bold mb-2">Build Your Own Launchpad</h3>
                <p className="text-xs text-[#777]">
                  With Tokena's open-source stack, you can deploy your own branded launchpad in minutes:
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-[#aaa] mt-3">
                  <li>Deploy the TokenFactory contract on your target EVM chain</li>
                  <li>Install <code className="bg-[#222] px-1 py-0.5 rounded text-white">@tokena/sdk</code> and configure your factory address</li>
                  <li>Clone the frontend, customize branding, and ship</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
