/**
 * CareerOs High-Precision Performance Monitoring & Telemetry Engine
 *
 * Tracks UI responsiveness, background queue throughput, API call latencies,
 * cache hit/miss rates, memory heap health, and render timings.
 */

export interface PerfMetricEntry {
  name: string;
  durationMs: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface CacheTelemetry {
  hits: number;
  misses: number;
}

export interface PerfSnapshot {
  apiRequestsTotal: number;
  apiRequestsActive: number;
  apiRequestsFailed: number;
  averageApiLatencyMs: number;
  activeBackgroundJobs: number;
  queuedBackgroundJobs: number;
  sourceProcessingRate: number; // sources per second
  matchCache: CacheTelemetry;
  sourceCache: CacheTelemetry;
  logoCache: CacheTelemetry;
  renderLatencies: Record<string, number>;
  memoryUsedMb?: number;
  memoryLimitMb?: number;
  memoryWarning: boolean;
  fps: number;
}

export class PerformanceMonitor {
  private apiRequestsTotal = 0;
  private apiRequestsActive = 0;
  private apiRequestsFailed = 0;
  private apiLatencies: number[] = [];
  private activeBackgroundJobs = 0;
  private queuedBackgroundJobs = 0;
  private recentSourceCompletions: number[] = []; // timestamps

  private matchCache: CacheTelemetry = { hits: 0, misses: 0 };
  private sourceCache: CacheTelemetry = { hits: 0, misses: 0 };
  private logoCache: CacheTelemetry = { hits: 0, misses: 0 };

  private renderLatencies: Record<string, number> = {};
  private metrics: PerfMetricEntry[] = [];
  private listeners: Set<(snapshot: PerfSnapshot) => void> = new Set();

  private fps = 60;
  private frameCount = 0;
  private lastFpsTimestamp = Date.now();

  constructor() {
    this.initFpsLoop();
  }

  private initFpsLoop(): void {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) return;
    const loop = () => {
      this.frameCount++;
      const now = Date.now();
      if (now - this.lastFpsTimestamp >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTimestamp));
        this.frameCount = 0;
        this.lastFpsTimestamp = now;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // --- API Tracking ---
  public trackApiStart(): () => void {
    this.apiRequestsTotal++;
    this.apiRequestsActive++;
    const start = performance.now();
    return () => {
      this.apiRequestsActive = Math.max(0, this.apiRequestsActive - 1);
      const latency = performance.now() - start;
      this.apiLatencies.push(latency);
      if (this.apiLatencies.length > 50) this.apiLatencies.shift();
      this.notify();
    };
  }

  public trackApiError(): void {
    this.apiRequestsFailed++;
    this.notify();
  }

  // --- Background Queue Tracking ---
  public setQueueStatus(active: number, queued: number): void {
    this.activeBackgroundJobs = active;
    this.queuedBackgroundJobs = queued;
    this.notify();
  }

  public recordSourceProcessed(): void {
    const now = Date.now();
    this.recentSourceCompletions.push(now);
    // Keep last 10 seconds of completions
    const tenSecAgo = now - 10000;
    this.recentSourceCompletions = this.recentSourceCompletions.filter((t) => t >= tenSecAgo);
    this.notify();
  }

  // --- Cache Tracking ---
  public recordCacheHit(type: 'match' | 'source' | 'logo'): void {
    if (type === 'match') this.matchCache.hits++;
    else if (type === 'source') this.sourceCache.hits++;
    else if (type === 'logo') this.logoCache.hits++;
  }

  public recordCacheMiss(type: 'match' | 'source' | 'logo'): void {
    if (type === 'match') this.matchCache.misses++;
    else if (type === 'source') this.sourceCache.misses++;
    else if (type === 'logo') this.logoCache.misses++;
  }

  // --- Timing Marks ---
  public measure(name: string, fn: () => void, metadata?: Record<string, unknown>): void {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;
    this.recordRenderTiming(name, duration, metadata);
  }

  public async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.recordRenderTiming(name, duration, metadata);
    }
  }

  public recordRenderTiming(name: string, durationMs: number, metadata?: Record<string, unknown>): void {
    this.renderLatencies[name] = Math.round(durationMs * 10) / 10;
    this.metrics.push({
      name,
      durationMs: Math.round(durationMs * 10) / 10,
      timestamp: Date.now(),
      metadata,
    });
    if (this.metrics.length > 100) this.metrics.shift();
    this.notify();
  }

  public getSnapshot(): PerfSnapshot {
    const avgLatency =
      this.apiLatencies.length > 0
        ? Math.round(this.apiLatencies.reduce((a, b) => a + b, 0) / this.apiLatencies.length)
        : 0;

    const sourceRate = Math.round((this.recentSourceCompletions.length / 10) * 10) / 10;

    let memoryUsedMb: number | undefined;
    let memoryLimitMb: number | undefined;
    let memoryWarning = false;

    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      memoryUsedMb = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      memoryLimitMb = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
      memoryWarning = memoryUsedMb > 450;
    }

    return {
      apiRequestsTotal: this.apiRequestsTotal,
      apiRequestsActive: this.apiRequestsActive,
      apiRequestsFailed: this.apiRequestsFailed,
      averageApiLatencyMs: avgLatency,
      activeBackgroundJobs: this.activeBackgroundJobs,
      queuedBackgroundJobs: this.queuedBackgroundJobs,
      sourceProcessingRate: sourceRate,
      matchCache: { ...this.matchCache },
      sourceCache: { ...this.sourceCache },
      logoCache: { ...this.logoCache },
      renderLatencies: { ...this.renderLatencies },
      memoryUsedMb,
      memoryLimitMb,
      memoryWarning,
      fps: this.fps,
    };
  }

  public subscribe(listener: (snapshot: PerfSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    if (this.listeners.size === 0) return;
    const snap = this.getSnapshot();
    this.listeners.forEach((l) => l(snap));
  }
}

export const perfMonitor = new PerformanceMonitor();
