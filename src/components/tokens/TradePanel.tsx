import { useState, useEffect } from 'react';
import { Info, Settings, Zap } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Launch } from '../../lib/supabase/queries';
import { CREATION_FEE_SOL } from '../../lib/meteora/constants';
import { formatSol, formatNumber } from '../../lib/utils';
import { buyTokens, sellTokens } from '../../lib/meteora/trade';
import { quoteBuy, quoteSell, BuyQuote, SellQuote } from '../../lib/meteora/quote';
import { parseTradeError } from '../../lib/meteora/errors';
import { useWalletBalance, useTokenBalance } from '../../hooks/useWalletBalance';
import { useDebounce } from '../../hooks/useDebounce';
import { useEvmWallet } from '../../hooks/useEvmWallet';
import { EVM_CHAINS } from '../../lib/evm/constants';
import { buyTokensEvm, sellTokensEvm, quoteBuyEvm, quoteSellEvm, EvmBuyQuote, EvmSellQuote } from '../../lib/evm/trade';
import { getEvmTokenBalance } from '../../lib/evm/pool-state';
import {
  jupiterBuyQuote,
  jupiterSellQuote,
  jupiterBuy,
  jupiterSell,
  JupiterBuyQuote,
  JupiterSellQuote,
} from '../../lib/jupiter/swap';

interface TradePanelProps {
  launch: Launch;
}

const QUICK_BUY_AMOUNTS = [0.1, 0.5, 1, 5];
const QUICK_SELL_PERCENTS = [25, 50, 75, 100];

export function TradePanel({ launch }: TradePanelProps) {
  const wallet = useWallet();
  const evmWallet = useEvmWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { solBalance } = useWalletBalance();
  const solTokenBalance = useTokenBalance(launch.mint_address);

  const isEvm = launch.chain !== 'solana' && launch.chain != null;
  const targetChain = isEvm ? EVM_CHAINS[launch.chain!] : null;
  const nativeSymbol = isEvm ? (targetChain?.nativeCurrency.symbol || 'ETH') : 'SOL';

  const [evmTokenBalance, setEvmTokenBalance] = useState(0);

  useEffect(() => {
    if (isEvm && evmWallet.address) {
      getEvmTokenBalance(launch.mint_address, evmWallet.address, launch.chain!).then(setEvmTokenBalance).catch(console.error);
    }
  }, [isEvm, evmWallet.address, launch.mint_address, launch.chain]);

  const tokenBalance = isEvm ? evmTokenBalance : solTokenBalance;
  const nativeBalance = isEvm ? parseFloat(evmWallet.balance || '0') : solBalance;
  const isWalletConnected = isEvm ? evmWallet.connected : wallet.connected;

  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [slippageStr, setSlippageStr] = useState<string>(() => localStorage.getItem('tokena_slippage') || '1');
  const [priorityFeeStr, setPriorityFeeStr] = useState<string>(() => localStorage.getItem('tokena_priority_fee') || '0');

  const slippage = parseFloat(slippageStr) || 1;
  const priorityFee = parseFloat(priorityFeeStr) || 0;

  const handleSlippageChange = (val: string) => {
    setSlippageStr(val);
    localStorage.setItem('tokena_slippage', val);
  };

  const handlePriorityFeeChange = (val: string) => {
    setPriorityFeeStr(val);
    localStorage.setItem('tokena_priority_fee', val);
  };
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<BuyQuote | SellQuote | EvmBuyQuote | EvmSellQuote | JupiterBuyQuote | JupiterSellQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const debouncedAmount = useDebounce(amount, 500);
  const isMigrated = launch.is_migrated;
  const isBuy = tab === 'buy';
  const poolAddress = launch.dbc_pool_address;

  // Use Jupiter for graduated Solana tokens, bonding curve for active ones
  const useJupiter = isMigrated && !isEvm;

  // Fetch real quote whenever input changes
  useEffect(() => {
    if (!debouncedAmount || parseFloat(debouncedAmount) <= 0 || (!poolAddress && !isEvm && !useJupiter)) {
      setQuote(null);
      return;
    }

    async function fetchQuote() {
      setQuoteLoading(true);
      try {
        const amt = parseFloat(debouncedAmount);
        const slippageBps = slippage * 100;
        
        if (useJupiter) {
          // Jupiter route for graduated tokens
          if (isBuy) {
            const q = await jupiterBuyQuote(launch.mint_address, amt, slippageBps);
            setQuote(q);
          } else {
            const q = await jupiterSellQuote(launch.mint_address, amt, slippageBps);
            setQuote(q);
          }
        } else if (isEvm) {
          if (isBuy) {
            const q = await quoteBuyEvm(launch.mint_address, amt, slippageBps, launch.chain!);
            setQuote(q);
          } else {
            const q = await quoteSellEvm(launch.mint_address, amt, slippageBps, launch.chain!);
            setQuote(q);
          }
        } else {
          if (isBuy) {
            const q = await quoteBuy(launch.mint_address, amt, slippageBps, connection);
            setQuote(q);
          } else {
            const q = await quoteSell(launch.mint_address, amt, slippageBps, connection);
            setQuote(q);
          }
        }
        setError(null);
      } catch (err: any) {
        console.error('Quote error:', err);
        setError('Could not fetch quote');
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    }

    fetchQuote();
  }, [debouncedAmount, isBuy, slippage, poolAddress, connection, useJupiter]);

  async function handleTrade() {
    if (!isWalletConnected) {
      if (isEvm) evmWallet.connect();
      else setVisible(true);
      return;
    }
    if (!amount || parseFloat(amount) <= 0 || (!poolAddress && !isEvm && !useJupiter)) return;

    setLoading(true);
    setError(null);
    setTxSig(null);

    try {
      const amt = parseFloat(amount);
      const slippageBps = slippage * 100;

      let result;
      if (useJupiter) {
        // Jupiter route for graduated tokens
        if (isBuy) {
          result = await jupiterBuy({
            mintAddress: launch.mint_address,
            solAmount: amt,
            slippageBps,
            priorityFeeSol: priorityFee,
            wallet,
            connection,
          });
        } else {
          result = await jupiterSell({
            mintAddress: launch.mint_address,
            tokenAmount: amt,
            slippageBps,
            priorityFeeSol: priorityFee,
            wallet,
            connection,
          });
        }
      } else if (isEvm) {
        if (isBuy) {
          result = await buyTokensEvm({
            tokenAddress: launch.mint_address,
            ethAmount: amount,
            minTokens: (quote as EvmBuyQuote)?.tokensOut ? ((quote as EvmBuyQuote).tokensOut * (1 - slippageBps / 10000)).toString() : '0',
            chainKey: launch.chain!,
            walletAddress: evmWallet.address!,
          });
        } else {
          result = await sellTokensEvm({
            tokenAddress: launch.mint_address,
            tokenAmount: amount,
            minEth: (quote as EvmSellQuote)?.minEthOut?.toString() || '0',
            chainKey: launch.chain!,
            walletAddress: evmWallet.address!,
          });
        }
      } else {
        if (isBuy) {
          result = await buyTokens({
            poolAddress: poolAddress!,
            mintAddress: launch.mint_address,
            wallet,
            connection,
            solAmount: amt,
            slippageBps,
            priorityFeeSol: priorityFee,
          });
        } else {
          result = await sellTokens({
            poolAddress: poolAddress!,
            mintAddress: launch.mint_address,
            wallet,
            connection,
            tokenAmount: amt,
            slippageBps,
            priorityFeeSol: priorityFee,
          });
        }
      }
      
      const signature = 'txHash' in result ? result.txHash : result.txSignature;
      setTxSig(signature);
      setAmount('');
      setQuote(null);
    } catch (err: any) {
      console.error('Raw trade error:', err);
      setError(parseTradeError(err));
    } finally {
      setLoading(false);
    }
  }

  const buyQuote = isBuy ? quote as any : null;
  const sellQuoteData = !isBuy ? quote as any : null;

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
      {/* Graduated badge */}
      {isMigrated && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#00D4AA]/5 border-b border-[#00D4AA]/20">
          <Zap size={12} className="text-[#00D4AA]" />
          <span className="text-xs font-mono text-[#00D4AA] font-semibold">Graduated</span>
          {useJupiter && (
            <span className="text-[10px] font-mono text-[#00D4AA]/50 ml-auto">via Jupiter</span>
          )}
        </div>
      )}

      <div className="flex border-b border-[#1a1a1a]">
        <button
          className={`flex-1 py-3 text-sm font-semibold font-ui transition-all ${tab === 'buy' ? 'text-[#00D4AA] border-b-2 border-[#00D4AA]' : 'text-[#555] hover:text-[#888]'}`}
          onClick={() => { setTab('buy'); setAmount(''); setQuote(null); setError(null); setTxSig(null); }}
        >
          Buy
        </button>
        <button
          className={`flex-1 py-3 text-sm font-semibold font-ui transition-all ${tab === 'sell' ? 'text-[#FF4444] border-b-2 border-[#FF4444]' : 'text-[#555] hover:text-[#888]'}`}
          onClick={() => { setTab('sell'); setAmount(''); setQuote(null); setError(null); setTxSig(null); }}
        >
          Sell
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Balance display */}
        {isWalletConnected && (
          <div className="flex justify-between text-xs font-mono text-[#444]">
            <span>{isBuy ? `${nativeSymbol} Balance` : `${launch.symbol} Balance`}</span>
            <span
              className="cursor-pointer hover:text-white transition-colors"
              onClick={() => {
                if (isBuy) {
                  setAmount(Math.max(0, nativeBalance - (isEvm ? 0.001 : 0.01)).toFixed(4)); // Reserve for fees
                } else {
                  setAmount(Math.floor(tokenBalance).toString());
                }
              }}
            >
              {isBuy ? `${nativeBalance.toFixed(4)} ${nativeSymbol}` : `${tokenBalance.toLocaleString()} ${launch.symbol}`} (Max)
            </span>
          </div>
        )}

        {/* Quick amounts */}
        <div className="flex gap-1.5">
          {(isBuy ? QUICK_BUY_AMOUNTS : QUICK_SELL_PERCENTS).map((v) => (
            <button
              key={v}
              onClick={() => {
                if (isBuy) {
                  setAmount(v.toString());
                } else {
                  setAmount(String(Math.floor((tokenBalance * v) / 100)));
                }
              }}
              className={`flex-1 py-1 text-xs font-mono rounded-md border transition-all ${amount === (isBuy ? v.toString() : String(Math.floor((tokenBalance * v) / 100)))
                ? 'border-[#F5A623] text-[#F5A623] bg-[#F5A623]/10'
                : 'border-[#1a1a1a] text-[#555] hover:border-[#2a2a2a] hover:text-[#888]'
                }`}
            >
              {isBuy ? `${v} ${nativeSymbol}` : `${v}%`}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <Input
          label={isBuy ? `${nativeSymbol} Amount` : 'Token Amount'}
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          suffix={isBuy ? nativeSymbol : launch.symbol}
          min="0"
          step="0.01"
        />

        {/* Quote display */}
        {(quoteLoading || quote) && (
          <div className="bg-[#111] rounded-lg p-3 flex flex-col gap-2 text-xs font-mono">
            {quoteLoading ? (
              <div className="text-[#333] text-center py-2">Fetching quote...</div>
            ) : quote ? (
              <>
                <div className="flex justify-between text-[#555]">
                  <span>You receive</span>
                  <span className="text-white">
                    {isBuy
                      ? `~${Math.floor(buyQuote?.tokensOut ?? 0).toLocaleString()} ${launch.symbol}`
                      : `~${formatSol(sellQuoteData?.solOut ?? sellQuoteData?.ethOut ?? 0)} ${nativeSymbol}`}
                  </span>
                </div>
                <div className="flex justify-between text-[#555]">
                  <span>Slippage Bound</span>
                  <span>{slippage}%</span>
                </div>
                {useJupiter && (quote as JupiterBuyQuote | JupiterSellQuote)?.route && (
                  <div className="flex justify-between text-[#555]">
                    <span>Route</span>
                    <span className="text-[#00D4AA]">{(quote as any).route}</span>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Settings Toggle */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1 text-xs font-mono transition-colors ${showSettings ? 'text-[#F5A623]' : 'text-[#555] hover:text-[#888]'}`}
          >
            <Settings size={12} />
            <span>Settings</span>
          </button>
        </div>

        {/* Slippage & Gas Settings */}
        {showSettings && (
          <div className="flex flex-col gap-3 p-3 bg-[#0d0d0d] rounded-lg border border-[#1a1a1a] animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-[#555]">
                <Info size={12} />
                <span>Slippage</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 5, 10].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSlippageChange(s.toString())}
                    className={`px-2 py-0.5 rounded border transition-all ${slippage === s ? 'border-[#F5A623] text-[#F5A623] bg-[#F5A623]/10' : 'border-[#1a1a1a] text-[#444] hover:text-[#888]'
                      }`}
                  >
                    {s}%
                  </button>
                ))}
                <div className="relative w-16">
                  <input
                    type="text"
                    value={slippageStr}
                    onChange={(e) => handleSlippageChange(e.target.value)}
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-0.5 text-right text-[#888] outline-none focus:border-[#F5A623] transition-colors pr-3"
                    placeholder="-"
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[#444]">%</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-[#555]">
                <Info size={12} />
                <span>Priority Fee</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[0, 0.0001, 0.0005, 0.001].map((f) => (
                  <button
                    key={f}
                    onClick={() => handlePriorityFeeChange(f.toString())}
                    className={`px-2 py-0.5 rounded border transition-all ${priorityFee === f ? 'border-[#00D4AA] text-[#00D4AA] bg-[#00D4AA]/10' : 'border-[#1a1a1a] text-[#444] hover:text-[#888]'
                      }`}
                  >
                    {f}
                  </button>
                ))}
                <div className="relative w-16">
                  <input
                    type="text"
                    value={priorityFeeStr}
                    onChange={(e) => handlePriorityFeeChange(e.target.value)}
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded px-2 py-0.5 text-right text-[#888] outline-none focus:border-[#00D4AA] transition-colors"
                    placeholder="-"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-[#FF4444]/10 border border-[#FF4444]/20 rounded-lg p-2.5 text-xs font-mono text-[#FF4444]">
            {error}
          </div>
        )}

        {/* Success */}
        {txSig && (
          <div className="bg-[#00D4AA]/10 border border-[#00D4AA]/20 rounded-lg p-2.5 text-xs font-mono text-[#00D4AA]">
            ✓ Transaction confirmed.{' '}
            <a
              href={isEvm ? `${targetChain?.explorerUrl}/tx/${txSig}` : `https://solscan.io/tx/${txSig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00D4AA] underline"
            >
              View on {isEvm ? 'Explorer' : 'Solscan'}
            </a>
          </div>
        )}

        {/* CTA */}
        <Button
          variant={isBuy ? 'buy' : 'sell'}
          size="lg"
          className="w-full"
          loading={loading}
          onClick={handleTrade}
          disabled={loading || (!amount && isWalletConnected) || (!!amount && parseFloat(amount) <= 0)}
        >
          {!isWalletConnected
            ? 'Connect Wallet'
            : loading
              ? 'Confirming...'
              : isBuy ? `Buy ${launch.symbol}` : `Sell ${launch.symbol}`}
        </Button>


      </div>
    </div>
  );
}
