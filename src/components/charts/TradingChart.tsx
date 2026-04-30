import { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TradingChartProps {
  data: CandlestickData[];
  height?: number;
}

export function TradingChart({ data, height = 300 }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0d0d0d' },
        textColor: '#444444',
        fontFamily: "'DM Mono', monospace",
      },
      grid: {
        vertLines: { color: '#111111' },
        horzLines: { color: '#111111' },
      },
      crosshair: {
        vertLine: { color: '#333', labelBackgroundColor: '#1a1a1a' },
        horzLine: { color: '#333', labelBackgroundColor: '#1a1a1a' },
      },
      rightPriceScale: { borderColor: '#111111', textColor: '#444' },
      timeScale: { borderColor: '#111111', timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
    });

    // lightweight-charts v5 API: use addSeries(CandlestickSeries, options)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00D4AA',
      downColor: '#FF4444',
      borderUpColor: '#00D4AA',
      borderDownColor: '#FF4444',
      wickUpColor: '#00D4AA',
      wickDownColor: '#FF4444',
    });

    if (data.length > 0) {
      candleSeries.setData(data as any);
      chart.timeScale().fitContent();
    } else {
      const now = Math.floor(Date.now() / 1000);
      const mockData = Array.from({ length: 50 }, (_, i) => {
        const base = 0.000008 + Math.sin(i * 0.3) * 0.000002;
        return {
          time: (now - (50 - i) * 300) as any,
          open: base,
          high: base * (1 + Math.random() * 0.05),
          low: base * (1 - Math.random() * 0.05),
          close: base * (1 + (Math.random() - 0.5) * 0.04),
        };
      });
      candleSeries.setData(mockData);
      chart.timeScale().fitContent();
    }

    chartRef.current = chart;
    seriesRef.current = candleSeries as any;

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data as any);
      chartRef.current?.timeScale().fitContent();
    }
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, background: '#0d0d0d', borderRadius: 8 }}
    />
  );
}
