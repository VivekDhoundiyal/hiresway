import React, { useState, useEffect } from 'react';
import { perfMonitor, PerfSnapshot } from './performanceMonitor';
import { Activity, X, Zap, Database, Cpu, Layers } from 'lucide-react';

export const PerformanceDebugModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<PerfSnapshot>(() => perfMonitor.getSnapshot());

  // Listen to keyboard shortcut Ctrl+Shift+P / Cmd+Shift+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Subscribe to performance monitor updates
  useEffect(() => {
    const unsubscribe = perfMonitor.subscribe(setSnapshot);
    return () => unsubscribe();
  }, []);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-3 right-3 z-50 px-2 py-1 bg-gray-900/80 hover:bg-gray-900 text-white rounded-md text-[11px] font-mono flex items-center gap-1.5 shadow-lg backdrop-blur-sm transition-all opacity-70 hover:opacity-100"
        title="Open Performance Debug Monitor (Ctrl+Shift+P)"
      >
        <Activity className="h-3 w-3 text-emerald-400" />
        <span>{snapshot.fps} FPS</span>
        <span className="text-gray-400">|</span>
        <span className="text-blue-300">{snapshot.averageApiLatencyMs}ms</span>
      </button>
    );
  }

  const calcRate = (hits: number, misses: number) => {
    const total = hits + misses;
    if (total === 0) return '0%';
    return `${Math.round((hits / total) * 100)}%`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">CareerOs Performance & Telemetry Engine</h3>
              <p className="text-[11px] text-gray-500">Real-time profiling metrics (Ctrl+Shift+P)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Top Quick Status Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">UI Framerate</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`text-lg font-bold ${
                    snapshot.fps >= 55 ? 'text-emerald-600' : snapshot.fps >= 30 ? 'text-amber-600' : 'text-red-600'
                  }`}
                >
                  {snapshot.fps} FPS
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Avg API Latency</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-lg font-bold text-blue-600">{snapshot.averageApiLatencyMs}ms</span>
                <span className="text-[10px] text-gray-400">({snapshot.apiRequestsTotal} calls)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Background Queue</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-lg font-bold text-purple-600">{snapshot.activeBackgroundJobs} active</span>
                <span className="text-[10px] text-gray-400">({snapshot.queuedBackgroundJobs} queued)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200/80">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Throughput</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-lg font-bold text-gray-800">{snapshot.sourceProcessingRate}/s</span>
                <span className="text-[10px] text-gray-400">sources</span>
              </div>
            </div>
          </div>

          {/* Caches Section */}
          <div className="rounded-xl border border-gray-200 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-gray-900">Multi-Level Cache Performance</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-900">Match Score Cache</span>
                  <span className="font-bold text-emerald-700">
                    {calcRate(snapshot.matchCache.hits, snapshot.matchCache.misses)}
                  </span>
                </div>
                <div className="text-[10.5px] text-emerald-700 flex justify-between">
                  <span>Hits: {snapshot.matchCache.hits}</span>
                  <span>Misses: {snapshot.matchCache.misses}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-900">Source Discovery Cache</span>
                  <span className="font-bold text-blue-700">
                    {calcRate(snapshot.sourceCache.hits, snapshot.sourceCache.misses)}
                  </span>
                </div>
                <div className="text-[10.5px] text-blue-700 flex justify-between">
                  <span>Hits: {snapshot.sourceCache.hits}</span>
                  <span>Misses: {snapshot.sourceCache.misses}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-100 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-purple-900">Company Logo Cache</span>
                  <span className="font-bold text-purple-700">
                    {calcRate(snapshot.logoCache.hits, snapshot.logoCache.misses)}
                  </span>
                </div>
                <div className="text-[10.5px] text-purple-700 flex justify-between">
                  <span>Hits: {snapshot.logoCache.hits}</span>
                  <span>Misses: {snapshot.logoCache.misses}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Memory Heap Health */}
          {snapshot.memoryUsedMb && (
            <div className="rounded-xl border border-gray-200 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-gray-700" />
                  <h4 className="text-xs font-bold text-gray-900">JS Heap Memory</h4>
                </div>
                <span className="text-xs font-mono font-bold text-gray-700">
                  {snapshot.memoryUsedMb} MB / {snapshot.memoryLimitMb} MB
                </span>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    snapshot.memoryWarning ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round(((snapshot.memoryUsedMb || 0) / (snapshot.memoryLimitMb || 1000)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Render Latencies */}
          <div className="rounded-xl border border-gray-200 p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <h4 className="text-xs font-bold text-gray-900">Component Render & Filter Latencies</h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(snapshot.renderLatencies).map(([name, latency]) => (
                <div key={name} className="p-2 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-600 truncate max-w-[140px]" title={name}>
                    {name}
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      latency < 20 ? 'text-emerald-600' : latency < 100 ? 'text-amber-600' : 'text-red-600'
                    }`}
                  >
                    {latency}ms
                  </span>
                </div>
              ))}
              {Object.keys(snapshot.renderLatencies).length === 0 && (
                <div className="col-span-full text-xs text-gray-400 text-center py-2">
                  No component render marks recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span>Press <kbd className="px-1.5 py-0.5 rounded border border-gray-300 bg-white font-mono text-[10px]">Ctrl+Shift+P</kbd> to toggle</span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-3 py-1 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
