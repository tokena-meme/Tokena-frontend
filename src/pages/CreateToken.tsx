import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Twitter, Send, Globe, Info, Rocket, AlertTriangle, Percent } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { uploadLaunchAssets } from '../lib/ipfs/pinata';
import { ImageUploader } from '../components/launch/ImageUploader';
import { CREATION_FEE_SOL } from '../lib/meteora/constants';
import { TOKENOMICS } from '../lib/constants/tokenomics';
import { quoteBuyOffchain } from '../lib/utils/marketcap';
import { useLaunchToken } from '../hooks/useLaunchToken';
import { usePrices } from '../hooks/usePrices';
import { formatUsd } from '../lib/utils';
import { useChain } from '../providers/ChainProvider';
import { useEvmWallet } from '../hooks/useEvmWallet';
import { createEvmToken } from '../lib/evm/factory';
import { VISIBLE_EVM_CHAINS, EVM_CHAINS } from '../lib/evm/constants';
import { parseEther } from 'ethers';
import { ChainSelector } from '../components/ui/ChainSelector';

interface FormData {
  name: string;
  symbol: string;
  description: string;
  image: File | null;
  imagePreview: string | null;
  twitter: string;
  telegram: string;
  website: string;
  initialBuySol: string;
  creatorFeePercent: number;
}

export function CreateToken() {
  const { chain, setChain, evmChainKey, setEvmChainKey } = useChain();

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-display font-bold text-white mb-2">Launch a token.</h1>
        <p className="text-[#555] font-mono text-sm">Deploy a bonding curve token on {chain === 'solana' ? 'Solana' : `${EVM_CHAINS[evmChainKey]?.name ?? 'EVM'}`}. One step — fill details and deploy.</p>
      </div>

      {/* Chain selector */}
      <div className="mb-6 w-max">
        <ChainSelector />
      </div>

      {chain === 'evm' ? <EvmCreateForm /> : <SolanaCreateForm />}
    </div>
  );
}

// ─── EVM Create Form ────────────────────────────────────────
function EvmCreateForm() {
  const navigate = useNavigate();
  const { evmChainKey } = useChain();
  const evmWallet = useEvmWallet();
  const chainConfig = EVM_CHAINS[evmChainKey];
  const nativeSymbol = chainConfig?.nativeCurrency.symbol ?? 'ETH';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'uploading' | 'deploying' | 'done' | 'error'>('idle');

  const [form, setForm] = useState({
    name: '',
    symbol: '',
    description: '',
    image: null as File | null,
    imagePreview: null as string | null,
    twitter: '',
    telegram: '',
    website: '',
    totalSupply: '1000000000',
    ethThreshold: '5',
    isTaxToken: false,
    devWallet: '',
    devBuyFeePercent: 0,
    devSellFeePercent: 0,
    marketingWallet: '',
    marketingBuyFeePercent: 0,
    marketingSellFeePercent: 0,
    initialBuyEth: '',
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleDeploy() {
    if (!evmWallet.connected || !evmWallet.address) {
      evmWallet.connect();
      return;
    }
    if (!form.name.trim() || !form.symbol.trim()) {
      setError('Name and Symbol are required');
      return;
    }
    if (!form.image) {
      setError('Please upload a token image');
      return;
    }

    setError(null);
    setLoading(true);
    setStep('uploading');

    try {
      const assets = await (await import('../lib/ipfs/pinata')).uploadLaunchAssets({
        imageFile: form.image,
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        description: form.description.trim(),
        creatorWallet: evmWallet.address,
        onImageProgress: () => { },
        onMetadataUpload: () => { },
      });

      setStep('deploying');

      // totalSupply in wei (18 decimals)
      const totalSupplyWei = parseEther(form.totalSupply);

      const result = await createEvmToken({
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        description: form.description.trim(),
        imageUrl: assets.imageHttpUrl,
        twitter: form.twitter || undefined,
        telegram: form.telegram || undefined,
        website: form.website || undefined,
        totalSupply: totalSupplyWei.toString(),
        ethThreshold: form.ethThreshold,
        isTaxToken: form.isTaxToken,
        devWallet: form.devWallet || evmWallet.address,
        devBuyFeePercent: form.devBuyFeePercent,
        devSellFeePercent: form.devSellFeePercent,
        marketingWallet: form.marketingWallet || evmWallet.address,
        marketingBuyFeePercent: form.marketingBuyFeePercent,
        marketingSellFeePercent: form.marketingSellFeePercent,
        initialBuyEth: form.initialBuyEth || '0',
        chainKey: evmChainKey,
        creatorWallet: evmWallet.address,
      });

      setStep('done');
      navigate(`/token/${result.tokenAddress}`);
    } catch (err: any) {
      console.error('EVM deploy error:', err);
      setError(err?.message ?? 'Failed to deploy token');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-6 mb-5">
        <div className="flex flex-col gap-5">
          {/* Image upload */}
          <div>
            <label className="text-xs font-mono text-[#888] uppercase tracking-wider mb-2 block">Token Image</label>
            <ImageUploader
              onFileSelected={(file, previewUrl) => {
                update('image', file);
                update('imagePreview', previewUrl);
              }}
              symbol={form.symbol}
              initialPreviewUrl={form.imagePreview}
            />
          </div>

          <Input label="Token Name" placeholder="My Token" value={form.name} onChange={(e) => update('name', e.target.value)} />
          <Input label="Symbol" placeholder="MTK" value={form.symbol} onChange={(e) => update('symbol', e.target.value.toUpperCase().slice(0, 10))} hint="Max 10 characters" />
          <Textarea label="Description (optional)" placeholder="A great token..." value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} />

          {/* Socials */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Twitter" placeholder="@yourtoken" value={form.twitter} onChange={(e) => update('twitter', e.target.value)} prefix={<Twitter size={12} />} />
            <Input label="Telegram" placeholder="t.me/yourtoken" value={form.telegram} onChange={(e) => update('telegram', e.target.value)} prefix={<Send size={12} />} />
            <Input label="Website" placeholder="https://..." value={form.website} onChange={(e) => update('website', e.target.value)} prefix={<Globe size={12} />} />
          </div>

          <div className="border-t border-[#111] pt-4">
            <Input label={`${nativeSymbol} Threshold`} type="text" value={form.ethThreshold} onChange={(e) => update('ethThreshold', e.target.value)} suffix={nativeSymbol} hint="Auto-finalize at this amount" />
          </div>

          {/* Tax toggle */}
          <div className="border-t border-[#111] pt-4">
            <label className="text-xs font-mono text-[#888] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Percent size={12} className="text-[#4A9EFF]" />
              Tax Configuration
            </label>
            <div className="bg-[#111] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isTaxToken}
                    onChange={(e) => update('isTaxToken', e.target.checked)}
                    className="accent-[#4A9EFF]"
                  />
                  <span className="text-sm font-mono text-[#888]">Enable buy/sell tax</span>
                </label>
              </div>

              {form.isTaxToken && (
                <div className="space-y-3 mt-3">
                  <Input label="Dev Wallet" placeholder="0x..." value={form.devWallet} onChange={(e) => update('devWallet', e.target.value)} hint="Leave empty to use your wallet" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Dev Buy Fee %" type="number" value={form.devBuyFeePercent || ''} onChange={(e) => update('devBuyFeePercent', Math.min(10, Math.max(0, Number(e.target.value))))} />
                    <Input label="Dev Sell Fee %" type="number" value={form.devSellFeePercent || ''} onChange={(e) => update('devSellFeePercent', Math.min(10, Math.max(0, Number(e.target.value))))} />
                  </div>
                  <Input label="Marketing Wallet" placeholder="0x..." value={form.marketingWallet} onChange={(e) => update('marketingWallet', e.target.value)} hint="Leave empty to use your wallet" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Marketing Buy Fee %" type="number" value={form.marketingBuyFeePercent || ''} onChange={(e) => update('marketingBuyFeePercent', Math.min(10, Math.max(0, Number(e.target.value))))} />
                    <Input label="Marketing Sell Fee %" type="number" value={form.marketingSellFeePercent || ''} onChange={(e) => update('marketingSellFeePercent', Math.min(10, Math.max(0, Number(e.target.value))))} />
                  </div>
                </div>
              )}

              <p className="text-xs font-mono text-[#555] leading-relaxed mt-3">
                {form.isTaxToken
                  ? 'A percentage revenue share is taken from your defined tax to maintain the platform infrastructure. The rest accumulates on-chain for you to claim.'
                  : 'Standard launch: a flat 0.4% trading fee is split between the creator and the platform (0.2% each).'}
              </p>
            </div>
          </div>

          {/* Initial buy */}
          <div className="border-t border-[#111] pt-4">
            <Input
              label={`Initial Buy (optional)`}
              type="number"
              placeholder="0.00"
              value={form.initialBuyEth}
              onChange={(e) => update('initialBuyEth', e.target.value)}
              suffix={nativeSymbol}
              hint={`Buy tokens immediately after launch with ${nativeSymbol}`}
            />
          </div>

          {/* Info box */}
          <div className="bg-[#111] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#555]">Chain</span>
              <span className="text-[#888]">{chainConfig?.name ?? evmChainKey}</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#555]">Total Supply</span>
              <span className="text-[#888]">{Number(form.totalSupply).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#555]">Finalization Threshold</span>
              <span className="text-[#888]">{form.ethThreshold} {nativeSymbol}</span>
            </div>
          </div>

          {/* Wallet status */}
          {!evmWallet.connected && (
            <div className="bg-[#FF4444]/5 border border-[#FF4444]/20 rounded-xl p-3 text-xs font-mono text-[#FF4444]">
              Connect your MetaMask wallet to deploy.
            </div>
          )}
          {evmWallet.connected && evmWallet.address && (
            <div className="bg-[#627EEA]/5 border border-[#627EEA]/20 rounded-xl p-3 text-xs font-mono text-[#627EEA]">
              Deploying from: {evmWallet.address.slice(0, 6)}...{evmWallet.address.slice(-4)}
            </div>
          )}

          {error && (
            <div className="bg-[#FF4444]/10 border border-[#FF4444]/20 rounded-xl p-3 text-xs font-mono text-[#FF4444]">
              {error}
            </div>
          )}
        </div>
      </div>

      <Button
        variant="primary"
        loading={step === 'uploading' || step === 'deploying'}
        onClick={handleDeploy}
        className="w-full py-3.5 flex items-center justify-center gap-2 text-base"
        disabled={step === 'uploading' || step === 'deploying' || step === 'done'}
      >
        <Rocket size={18} />
        {!evmWallet.connected
          ? 'Connect Wallet'
          : step === 'uploading' ? 'Uploading image...'
            : step === 'deploying' ? 'Confirm in wallet...'
              : step === 'done' ? 'Launched! Redirecting...'
                : step === 'error' ? 'Retry Deploy'
                  : `Deploy on ${chainConfig?.name ?? 'EVM'}`}
      </Button>
    </>
  );
}

// ─── Solana Create Form (Original) ──────────────────────────
function SolanaCreateForm() {
  const navigate = useNavigate();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { launch: launchToken, isLoading: launchLoading, error: launchError } = useLaunchToken();
  const solPrice = usePrices().solPrice || 150;const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [deployError, setDeployError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "uploading-image" | "uploading-meta" | "deploying" | "done" | "error">("idle");
  const [imgProgress, setImgProgress] = useState(0);

  const [form, setForm] = useState<FormData>({
    name: '',
    symbol: '',
    description: '',
    image: null,
    imagePreview: null,
    twitter: '',
    telegram: '',
    website: '',
    initialBuySol: '',
    creatorFeePercent: 0,
  });

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      update('image', file);
      update('imagePreview', URL.createObjectURL(file));
    }
  }, []);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      update('image', file);
      update('imagePreview', URL.createObjectURL(file));
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.symbol.trim()) newErrors.symbol = 'Symbol is required';
    if (form.symbol.length > 10) newErrors.symbol = 'Max 10 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleDeploy() {
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }
    if (!form.image) {
      setDeployError('Please upload a token image');
      setStep('error');
      return;
    }
    if (!validate()) return;

    setStep("uploading-image");
    setDeployError(null);
    setLoading(true);

    try {
      // 1. Upload to IPFS
      const assets = await uploadLaunchAssets({
        imageFile: form.image,
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        description: form.description.trim(),
        website: form.website || undefined,
        twitter: form.twitter || undefined,
        telegram: form.telegram || undefined,
        creatorWallet: publicKey.toString(),
        onImageProgress: (pct) => {
          setImgProgress(pct);
        },
        onMetadataUpload: () => {
          setStep("uploading-meta");
        },
      });

      // 2. Deploy on-chain
      setStep("deploying");

      const result = await launchToken({
        name: form.name.trim(),
        symbol: form.symbol.trim().toUpperCase(),
        description: form.description.trim(),
        imageUrl: assets.imageHttpUrl,
        metadataUri: assets.metadataUri,
        twitter: form.twitter || undefined,
        telegram: form.telegram || undefined,
        website: form.website || undefined,
        initialPriceSol: 0.0000015,
        migrationThresholdSol: TOKENOMICS.MIGRATION_LP_SOL,
        totalSupply: TOKENOMICS.TOTAL_SUPPLY,
        creatorFeePercent: form.creatorFeePercent,
        initialBuySol: initialBuyNum > 0 ? initialBuyNum : undefined,
      });

      setStep("done");
      if (result) {
        navigate(`/token/${result.mintAddress}`);
      }
    } catch (err: any) {
      console.error('Deploy error:', err);
      setDeployError(err?.message ?? 'Failed to deploy token. Please try again.');
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  const isDeploying = loading || launchLoading;
  const initialBuyNum = parseFloat(form.initialBuySol) || 0;
  const estimatedTokens = initialBuyNum > 0
    ? Math.floor(quoteBuyOffchain(initialBuyNum, 0, solPrice).tokensOut)
    : 0;


  return (
    <>
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-6 mb-5">
        <div className="flex flex-col gap-5">
          {/* Image upload */}
          <div>
            <label className="text-xs font-mono text-[#888] uppercase tracking-wider mb-2 block">Token Image</label>
            <ImageUploader
              onFileSelected={(file, previewUrl) => {
                update('image', file);
                update('imagePreview', previewUrl);
              }}
              symbol={form.symbol}
              initialPreviewUrl={form.imagePreview}
            />
          </div>

          {/* Token details */}
          <Input label="Token Name" placeholder="Fire Pepe" value={form.name} onChange={(e) => update('name', e.target.value)} error={errors.name} />
          <Input
            label="Symbol"
            placeholder="FPEPE"
            value={form.symbol}
            onChange={(e) => update('symbol', e.target.value.toUpperCase().slice(0, 10))}
            error={errors.symbol}
            hint="Max 10 characters, auto-uppercased"
          />
          <Textarea
            label="Description (optional)"
            placeholder="The hottest meme on Solana..."
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
          />

          {/* Socials */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Twitter"
              placeholder="@yourtoken"
              value={form.twitter}
              onChange={(e) => update('twitter', e.target.value)}
              prefix={<Twitter size={12} />}
            />
            <Input
              label="Telegram"
              placeholder="t.me/yourtoken"
              value={form.telegram}
              onChange={(e) => update('telegram', e.target.value)}
              prefix={<Send size={12} />}
            />
            <Input
              label="Website"
              placeholder="https://..."
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
              prefix={<Globe size={12} />}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-[#111] pt-4">
            <Input
              label="Initial Buy (optional)"
              type="number"
              placeholder="0.00"
              value={form.initialBuySol}
              onChange={(e) => update('initialBuySol', e.target.value)}
              suffix="SOL"
              hint={initialBuyNum > 0
                ? `≈ ${estimatedTokens.toLocaleString()} tokens · ${formatUsd(initialBuyNum * solPrice)}`
                : 'Buy tokens immediately after launch'
              }
            />
          </div>

          {/* Tax Selector */}
          <div className="border-t border-[#111] pt-4">
            <label className="text-xs font-mono text-[#888] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Percent size={12} className="text-[#4A9EFF]" />
              Tax
            </label>
            <div className="bg-[#111] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={form.creatorFeePercent || ''}
                  placeholder="0.0"
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val)) { update('creatorFeePercent', 0); return; }
                    update('creatorFeePercent', Math.min(5, Math.max(0, val)));
                  }}
                  className="tokena-input flex-1 text-sm px-3 py-2 rounded-lg font-mono"
                />
                <span className="text-sm font-mono text-[#555]">%</span>
              </div>
              <p className="text-xs font-mono text-[#555] leading-relaxed">
                Set a tax from <span className="text-[#888]">0%</span> to <span className="text-[#888]">5%</span> on every buy and sell. You earn this fee directly to your wallet.
              </p>

              {/* High fee warning */}
              {form.creatorFeePercent > 3 && (
                <div className="mt-3 flex items-start gap-2 bg-[#FF4444]/5 border border-[#FF4444]/15 rounded-lg p-2.5">
                  <AlertTriangle size={12} className="text-[#FF4444] flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-mono text-[#FF4444]/80 leading-relaxed">
                    High tax may discourage traders. Fees above 3% are flagged on token cards.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Info box */}
          <div className="bg-[#111] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#555]">Total Supply</span>
              <span className="text-[#888]">{TOKENOMICS.TOTAL_SUPPLY.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#555]">Migration Threshold</span>
              <span className="text-[#888]">{TOKENOMICS.MIGRATION_LP_SOL} SOL · {formatUsd(TOKENOMICS.MIGRATION_LP_SOL * solPrice)}</span>
            </div>

          </div>

          {/* Tip */}
          <div className="bg-[#F5A623]/5 border border-[#F5A623]/15 rounded-xl p-3.5">
            <div className="flex items-start gap-2">
              <Info size={14} className="text-[#F5A623] flex-shrink-0 mt-0.5" />
              <p className="text-xs font-mono text-[#888] leading-relaxed">
                When <span className="text-[#F5A623]">{TOKENOMICS.MIGRATION_LP_SOL} SOL</span> is raised, your bonding curve auto-graduates to a decentralized exchange (DEX) pool. Liquidity is locked forever.
              </p>
            </div>
          </div>

          {/* Wallet status */}
          {!connected && (
            <div className="bg-[#FF4444]/5 border border-[#FF4444]/20 rounded-xl p-3 text-xs font-mono text-[#FF4444]">
              Connect your wallet to deploy.
            </div>
          )}
          {connected && publicKey && (
            <div className="bg-[#00D4AA]/5 border border-[#00D4AA]/20 rounded-xl p-3 text-xs font-mono text-[#00D4AA]">
              Deploying from: {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
            </div>
          )}

          {/* Errors */}
          {(deployError || launchError) && (
            <div className="bg-[#FF4444]/10 border border-[#FF4444]/20 rounded-xl p-3 text-xs font-mono text-[#FF4444]">
              {deployError || launchError}
            </div>
          )}
        </div>
      </div>

      {/* Deploy button */}
      <Button
        variant="primary"
        loading={step === "uploading-image" || step === "uploading-meta" || step === "deploying"}
        onClick={handleDeploy}
        className="w-full py-3.5 flex items-center justify-center gap-2 text-base"
        disabled={step === "uploading-image" || step === "uploading-meta" || step === "deploying" || step === "done"}
      >
        <Rocket size={18} />
        {!connected
          ? 'Connect Wallet'
          : step === 'uploading-image' ? `Uploading image... ${imgProgress}%`
            : step === 'uploading-meta' ? 'Uploading metadata...'
              : step === 'deploying' ? 'Confirm in wallet...'
                : step === 'done' ? 'Launched! Redirecting...'
                  : step === 'error' ? 'Retry Deploy'
                    : 'Deploy Token'}
      </Button>

    </>
  );
}
