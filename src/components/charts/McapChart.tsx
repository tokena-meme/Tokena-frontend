"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";
import {
  buildMcapCandles,
  buildLaunchCandle,
  appendTick,
  McapCandle,
  Interval,
  RawTrade,
} from "@/lib/charts/mcap-candles";
import {
  getMcapUsd,
  getMigrationMcapUsd,
  getLaunchMcapUsd,
  formatMcapUsd,
  formatTokenPriceUsd,
  getTokenPriceUsd,
  getMigrationProgress,
} from "@/lib/utils/marketcap";
import { getTradesByMint, subscribeToTrades } from "@/lib/supabase/queries";
import { useOnChainMcap } from "@/hooks/useOnChainMcap";
import { usePoolState } from "@/hooks/usePoolState";

interface McapChartProps {
  mintAddress:     string;
  launchCreatedAt: string;
  currentSolRaised:number;
  solPriceUsd:     number;
  tokenColor?:     string;
  symbol:          string;
  nativeSymbol?:   string;
  launchMcapUsd?:  number; 
  currentMcapUsd?: number;
  migrationMcapUsd?: number;
  progressPercent?: number;
  isEvm?: boolean;
  totalSupply?: number;
  poolAddress?:    string;
}

const INTERVALS: Interval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

export function McapChart({
  mintAddress,
  launchCreatedAt,
  currentSolRaised,
  solPriceUsd,
  tokenColor = "#F5A623",
  symbol,
  nativeSymbol = "SOL",
  launchMcapUsd,
  currentMcapUsd,
  migrationMcapUsd,
  progressPercent,
  isEvm = false,
  totalSupply,
  poolAddress,
}: McapChartProps) {
  const wrapRef    = useRef<HTMLDivElement>(null);
  const chartRef   = useRef<IChartApi | null>(null);
  const candleRef  = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef     = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<McapCandle[]>([]);

  // On-chain live fetching if poolAddress is provided
  const onChainMcap = useOnChainMcap(!isEvm ? (poolAddress ?? null) : null, 15000);
  const { state: poolState } = usePoolState(!isEvm ? (poolAddress ?? null) : null);

  // Derive the best live on-chain MCAP
  const liveOnChainMcapUsd = onChainMcap?.marketCapUsd ?? (poolState ? getMcapUsd(poolState.solRaised, solPriceUsd) : null);
  
  // Use the most live value available (prop or internal hook)
  const effectiveLiveMcapUsd = liveOnChainMcapUsd ?? currentMcapUsd;

  const [intervalOption, setIntervalOption] = useState<Interval>("5m");
  const [loading,  setLoading]  = useState(true);
  const [tooltip,  setTooltip]  = useState<{
    mcap: string; change: string; volume: string; time: string;
  } | null>(null);
  const [stats, setStats] = useState({
    mcap:      effectiveLiveMcapUsd ?? getMcapUsd(currentSolRaised, solPriceUsd),
    change24h: 0,
    high24h:   0,
    low24h:    0,
    vol24h:    0,
    price:     effectiveLiveMcapUsd ? effectiveLiveMcapUsd / (totalSupply ?? 1_000_000_000) : getTokenPriceUsd(currentSolRaised, solPriceUsd),
  });

  // ── INIT CHART ──────────────────────────────────────────────

  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      width:  wrapRef.current.clientWidth,
      height: 340,
      layout: {
        background:  { type: ColorType.Solid, color: "#0d0d0d" },
        textColor:   "#555",
        fontFamily:  "'DM Mono', monospace",
        fontSize:    11,
      },
      grid: {
        vertLines: { color: "#0f0f0f" },
        horzLines: { color: "#111" },
      },
      crosshair: {
        mode:      CrosshairMode.Normal,
        vertLine:  { color: "#2a2a2a", labelBackgroundColor: "#1a1a1a" },
        horzLine:  { color: "#2a2a2a", labelBackgroundColor: "#1a1a1a" },
      },
      rightPriceScale: {
        borderColor: "#111",
        textColor:   "#555",
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
      timeScale: {
        borderColor:    "#111",
        timeVisible:    true,
        secondsVisible: false,
        rightOffset:    8,
        barSpacing:     10,
      },
    });

    // ── Candlestick series ─────────────────────────────────────
    const candles = chart.addSeries(CandlestickSeries, {
      upColor:          "#00D4AA",
      downColor:        "#FF4444",
      borderUpColor:    "#00D4AA",
      borderDownColor:  "#FF4444",
      wickUpColor:      "#00D4AA40",
      wickDownColor:    "#FF444440",
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: {
        type:      "custom",
        formatter: (v: number) => formatMcapUsd(v),
        minMove:   0.01,
      },
    });

    // ── Volume histogram ───────────────────────────────────────
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat:      { type: "volume" },
      priceScaleId:     "vol",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.80, bottom: 0 },
    });

    // ── Crosshair tooltip ─────────────────────────────────────
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.size) {
        setTooltip(null);
        return;
      }
      const c = param.seriesData.get(candles) as CandlestickData | undefined;
      if (!c) return;
      const change = ((c.close - c.open) / c.open) * 100;
      const date   = new Date((param.time as number) * 1000);
      setTooltip({
        mcap:   formatMcapUsd(c.close),
        change: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
        volume: "", // filled from candle lookup below
        time:   date.toLocaleString(),
      });
    });

    chartRef.current  = chart;
    candleRef.current = candles;
    volRef.current    = vol;

    const obs = new ResizeObserver(() => {
      if (wrapRef.current)
        chart.applyOptions({ width: wrapRef.current.clientWidth });
    });
    obs.observe(wrapRef.current);

    return () => { obs.disconnect(); chart.remove(); };
  }, []);

  // ── LOAD DATA ────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const trades = (await getTradesByMint(mintAddress, 1000)) as RawTrade[];

      const effectiveLaunchMcapUsd = (isEvm && (!launchMcapUsd || launchMcapUsd === 0)) ? currentMcapUsd : launchMcapUsd;
      const candles =
        trades.length === 0
          ? [buildLaunchCandle(new Date(launchCreatedAt), solPriceUsd, effectiveLaunchMcapUsd)]
          : buildMcapCandles(trades, intervalOption, solPriceUsd, isEvm, totalSupply);

      candlesRef.current = candles;

      // Push to TradingView
      const tvC: CandlestickData[] = candles.map((c) => ({
        time:  c.time as any,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      }));

      const tvV: HistogramData[] = candles.map((c) => ({
        time:  c.time as any,
        value: c.volume,
        color:
          c.buyVolume >= c.sellVolume
            ? "rgba(0,212,170,0.35)"
            : "rgba(255,68,68,0.35)",
      }));

      candleRef.current?.setData(tvC);
      volRef.current?.setData(tvV);
      chartRef.current?.timeScale().fitContent();

      // 24h stats
      const now       = Date.now() / 1000;
      const past24h   = candles.filter((c) => c.time >= now - 86400);
      const firstMcap = past24h[0]?.open ?? candles[0]?.open ?? 0;
      const lastCandle = candles[candles.length - 1];
      const finalMcap = currentMcapUsd ?? (lastCandle?.close ?? 0);
      
      // If we have a more fresh currentMcapUsd than the last trade, update the last candle to match
      if (lastCandle && currentMcapUsd && Math.abs(currentMcapUsd - lastCandle.close) > 0.01) {
        lastCandle.close = currentMcapUsd;
        lastCandle.high = Math.max(lastCandle.high, currentMcapUsd);
        lastCandle.low = Math.min(lastCandle.low, currentMcapUsd);
        
        // Re-push to series to ensure chart matches header
        candleRef.current?.update({
          time:  lastCandle.time as any,
          open:  lastCandle.open,
          high:  lastCandle.high,
          low:   lastCandle.low,
          close: lastCandle.close,
        });
      }

      setStats({
        mcap:      finalMcap,
        change24h: firstMcap > 0 ? ((finalMcap - firstMcap) / firstMcap) * 100 : 0,
        high24h:   Math.max(...(past24h.length ? past24h : candles).map((c) => c.high), finalMcap),
        low24h:    Math.min(...(past24h.length ? past24h : candles).map((c) => c.low), finalMcap),
        vol24h:    past24h.reduce((s, c) => s + c.volume, 0),
        price:     currentMcapUsd ? currentMcapUsd / (totalSupply ?? 1_000_000_000) : getTokenPriceUsd(currentSolRaised, solPriceUsd),
      });
    } catch (e) {
      console.error("Chart load error:", e);
    } finally {
      setLoading(false);
    }
  }, [mintAddress, intervalOption, solPriceUsd, launchCreatedAt]);

  useEffect(() => { load(); }, [load]);
  
  // Sync stats with prop changes or internal on-chain hook updates
  useEffect(() => {
    if (effectiveLiveMcapUsd && Math.abs(effectiveLiveMcapUsd - stats.mcap) > 0.01) {
      setStats(prev => ({
        ...prev,
        mcap: effectiveLiveMcapUsd,
        price: effectiveLiveMcapUsd / (totalSupply ?? 1_000_000_000),
        high24h: Math.max(prev.high24h, effectiveLiveMcapUsd),
        low24h: prev.low24h === 0 ? effectiveLiveMcapUsd : Math.min(prev.low24h, effectiveLiveMcapUsd)
      }));
      
      // Also update the last candle on the chart to reflect the live on-chain value
      if (candleRef.current && candlesRef.current.length > 0) {
        const lastCandle = candlesRef.current[candlesRef.current.length - 1];
        lastCandle.close = effectiveLiveMcapUsd;
        lastCandle.high = Math.max(lastCandle.high, effectiveLiveMcapUsd);
        lastCandle.low = Math.min(lastCandle.low, effectiveLiveMcapUsd);
        
        candleRef.current.update({
          time: lastCandle.time as any,
          open: lastCandle.open,
          high: lastCandle.high,
          low: lastCandle.low,
          close: lastCandle.close,
        });
      }
    }
  }, [effectiveLiveMcapUsd, totalSupply]);

  // ── REALTIME ────────────────────────────────────────────────

  useEffect(() => {
    let channelSub: { unsubscribe: () => void } | null = null;
    
    const sub = subscribeToTrades(mintAddress, (trade: any) => {
      if (!candleRef.current || !volRef.current) return;

      const updated = appendTick(candlesRef.current, trade, intervalOption, solPriceUsd, isEvm, totalSupply);
      candlesRef.current = updated;

      const last = updated[updated.length - 1];

      candleRef.current.update({
        time:  last.time as any,
        open:  last.open,
        high:  last.high,
        low:   last.low,
        close: last.close,
      });

      volRef.current.update({
        time:  last.time as any,
        value: last.volume,
        color:
          last.buyVolume >= last.sellVolume
            ? "rgba(0,212,170,0.35)"
            : "rgba(255,68,68,0.35)",
      });

      setStats((prev) => ({
        ...prev,
        mcap:    last.close,
        high24h: Math.max(prev.high24h, last.close),
        low24h:  prev.low24h === 0 ? last.close : Math.min(prev.low24h, last.close),
        vol24h:  prev.vol24h + Number(trade.sol_amount),
        price:   isEvm && totalSupply ? trade.price_per_token * solPriceUsd : getTokenPriceUsd(trade.sol_raised_after, solPriceUsd),
      }));
    });
    channelSub = sub as any;

    return () => { channelSub?.unsubscribe(); };
  }, [mintAddress, intervalOption, solPriceUsd]);

  // ── RENDER ───────────────────────────────────────────────────
  // Derive values for display that prioritize the most live on-chain data
  const displayMcap = effectiveLiveMcapUsd ?? stats.mcap;
  const displayPrice = effectiveLiveMcapUsd ? effectiveLiveMcapUsd / (totalSupply ?? 1_000_000_000) : stats.price;

  return (
    <div
      style={{
        background:   "#0d0d0d",
        border:       "1px solid #1a1a1a",
        borderRadius: 12,
        overflow:     "hidden",
      }}
    >
      {/* ── STATS HEADER ── */}
      <div
        style={{
          padding:     "18px 20px 0",
          display:     "flex",
          flexWrap:    "wrap",
          gap:         "24px 40px",
          alignItems:  "flex-end",
        }}
      >
        {/* Market cap — headline number */}
        <div>
          <div
            style={{
              fontSize:      10,
              color:         "#333",
              fontFamily:    "'DM Mono', monospace",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom:  4,
            }}
          >
            Market Cap
          </div>
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize:   32,
              fontWeight: 700,
              lineHeight: 1,
              color:      "#fff",
            }}
          >
            {formatMcapUsd(displayMcap)}
          </div>
          <div
            style={{
              fontSize:   12,
              fontFamily: "'DM Mono', monospace",
              color:      stats.change24h >= 0 ? "#00D4AA" : "#FF4444",
              marginTop:  4,
              fontWeight: 600,
            }}
          >
            {stats.change24h >= 0 ? "+" : ""}
            {stats.change24h.toFixed(2)}% (24h)
          </div>
        </div>

        {/* Token price */}
        <div style={{ paddingBottom: 6 }}>
          <div
            style={{
              fontSize:      10,
              color:         "#333",
              fontFamily:    "'DM Mono', monospace",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom:  4,
            }}
          >
            Token Price
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize:   16,
              color:      "#888",
            }}
          >
            {formatTokenPriceUsd(displayPrice)}
          </div>
        </div>

        {/* 24h stats row */}
        <div
          style={{
            display:       "flex",
            gap:           24,
            paddingBottom: 6,
            flexWrap:      "wrap",
          }}
        >
          {[
            [`Vol 24h`,  `${stats.vol24h.toFixed(2)} ${nativeSymbol}`],
            ["High 24h", formatMcapUsd(stats.high24h)],
            ["Low 24h",  formatMcapUsd(stats.low24h)],
          ].map(([label, value]) => (
            <div key={label}>
              <div
                style={{
                  fontSize:      10,
                  color:         "#333",
                  fontFamily:    "'DM Mono', monospace",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom:  3,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize:   13,
                  fontFamily: "'DM Mono', monospace",
                  color:      "#666",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── INTERVAL SELECTOR ── */}
      <div
        style={{
          display:        "flex",
          gap:            4,
          padding:        "14px 20px",
          borderBottom:   "1px solid #111",
          alignItems:     "center",
        }}
      >
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            onClick={() => setIntervalOption(iv)}
            style={{
              padding:       "4px 12px",
              borderRadius:  4,
              background:    intervalOption === iv ? "rgba(245,166,35,0.12)" : "transparent",
              border:        `1px solid ${intervalOption === iv ? "rgba(245,166,35,0.25)" : "transparent"}`,
              fontSize:      11,
              color:         intervalOption === iv ? "#F5A623" : "#444",
              cursor:        "pointer",
              fontFamily:    "'DM Mono', monospace",
              letterSpacing: 1,
              transition:    "all 0.15s",
            }}
          >
            {iv.toUpperCase()}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Live indicator */}
        <div
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        5,
            fontSize:   10,
            color:      "#333",
            fontFamily: "'DM Mono', monospace",
            letterSpacing: 1,
          }}
        >
          <span
            style={{
              width:        5,
              height:       5,
              borderRadius: "50%",
              background:   "#00D4AA",
              display:      "inline-block",
              boxShadow:    "0 0 6px #00D4AA",
              animation:    "pulse 2s infinite",
            }}
          />
          LIVE
        </div>

        {loading && (
          <span
            style={{
              fontSize:   10,
              color:      "#333",
              fontFamily: "'DM Mono', monospace",
              marginLeft: 8,
            }}
          >
            Loading...
          </span>
        )}
      </div>

      {/* ── CHART CANVAS ── */}
      <div ref={wrapRef} style={{ width: "100%", height: 340 }} />

      {/* ── MIGRATION REFERENCE BAR ── */}
      <div
        style={{
          display:       "flex",
          gap:           0,
          borderTop:     "1px solid #111",
          background:    "#080808",
        }}
      >
        {[
          {
            label: "Launch Mcap",
            value: formatMcapUsd((isEvm && (!launchMcapUsd || launchMcapUsd === 0) ? currentMcapUsd : launchMcapUsd) ?? getLaunchMcapUsd(solPriceUsd)),
            color: "#333",
          },
          {
            label: "Current Mcap",
            value: formatMcapUsd(displayMcap),
            color: tokenColor,
          },
          {
            label: "Migration Mcap",
            value: formatMcapUsd(migrationMcapUsd ?? getMigrationMcapUsd(solPriceUsd)),
            color: "#00D4AA",
          },
          {
            label: "Progress",
            value: `${(progressPercent ?? getMigrationProgress(currentSolRaised)).toFixed(1)}%`,
            color: "#F5A623",
          },
        ].map(({ label, value, color }, i, arr) => (
          <div
            key={label}
            style={{
              flex:        1,
              padding:     "10px 16px",
              borderRight: i < arr.length - 1 ? "1px solid #111" : "none",
            }}
          >
            <div
              style={{
                fontSize:      9,
                color:         "#333",
                fontFamily:    "'DM Mono', monospace",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom:  3,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize:   12,
                fontFamily: "'DM Mono', monospace",
                color,
                fontWeight: 600,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
