/**
 * CareerOs Controlled Concurrency Background Worker Queue
 *
 * Implements priority scheduling, controlled concurrency (N=8 concurrent workers),
 * per-domain rate limiting, exponential backoff retries, and task cancellation.
 * Ensures the main UI thread never locks up during heavy workloads.
 */

import { perfMonitor } from '../perf/performanceMonitor';

export type TaskPriority = 'high' | 'medium' | 'low';

export interface QueueTask<T = any> {
  id: string;
  name: string;
  priority: TaskPriority;
  domain?: string;
  execute: (signal: AbortSignal) => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
  maxRetries?: number;
  retries?: number;
  abortController?: AbortController;
  addedAt: number;
}

export interface WorkerQueueTelemetry {
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
  concurrencyLimit: number;
}

export class WorkerQueue {
  private highQueue: QueueTask[] = [];
  private mediumQueue: QueueTask[] = [];
  private lowQueue: QueueTask[] = [];

  private activeTasks: Map<string, QueueTask> = new Map();
  private domainActiveCount: Map<string, number> = new Map();

  private concurrencyLimit = 8;
  private maxPerDomain = 3;

  private completedTotal = 0;
  private failedTotal = 0;
  private isProcessing = false;

  constructor(concurrencyLimit = 8) {
    this.concurrencyLimit = concurrencyLimit;
  }

  public setConcurrencyLimit(limit: number): void {
    this.concurrencyLimit = Math.max(1, limit);
    this.pump();
  }

  public enqueue<T>(task: Omit<QueueTask<T>, 'addedAt' | 'retries'>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const fullTask: QueueTask<T> = {
        ...task,
        addedAt: Date.now(),
        retries: 0,
        maxRetries: task.maxRetries ?? 1,
        onSuccess: (res) => {
          task.onSuccess?.(res);
          resolve(res);
        },
        onError: (err) => {
          task.onError?.(err);
          reject(err);
        },
      };

      if (task.priority === 'high') {
        this.highQueue.push(fullTask);
      } else if (task.priority === 'medium') {
        this.mediumQueue.push(fullTask);
      } else {
        this.lowQueue.push(fullTask);
      }

      this.updateTelemetry();
      this.pump();
    });
  }

  public cancel(taskId: string): boolean {
    // Check if queued
    const removeFrom = (arr: QueueTask[]) => {
      const idx = arr.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        arr.splice(idx, 1);
        return true;
      }
      return false;
    };

    if (removeFrom(this.highQueue) || removeFrom(this.mediumQueue) || removeFrom(this.lowQueue)) {
      this.updateTelemetry();
      return true;
    }

    // Check if running
    const running = this.activeTasks.get(taskId);
    if (running && running.abortController) {
      running.abortController.abort();
      this.activeTasks.delete(taskId);
      if (running.domain) {
        const current = this.domainActiveCount.get(running.domain) || 1;
        this.domainActiveCount.set(running.domain, Math.max(0, current - 1));
      }
      this.updateTelemetry();
      this.pump();
      return true;
    }

    return false;
  }

  public cancelAll(): void {
    this.highQueue = [];
    this.mediumQueue = [];
    this.lowQueue = [];

    this.activeTasks.forEach((task) => {
      task.abortController?.abort();
    });
    this.activeTasks.clear();
    this.domainActiveCount.clear();
    this.updateTelemetry();
  }

  private pickNextEligibleTask(): QueueTask | null {
    const queues = [this.highQueue, this.mediumQueue, this.lowQueue];

    for (const queue of queues) {
      for (let i = 0; i < queue.length; i++) {
        const candidate = queue[i];
        if (candidate.domain) {
          const domainCount = this.domainActiveCount.get(candidate.domain) || 0;
          if (domainCount >= this.maxPerDomain) {
            // Domain rate limit exceeded; skip candidate for now
            continue;
          }
        }
        // Found eligible task
        queue.splice(i, 1);
        return candidate;
      }
    }
    return null;
  }

  private pump(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.activeTasks.size < this.concurrencyLimit) {
        const task = this.pickNextEligibleTask();
        if (!task) break;

        this.startTask(task);
      }
    } finally {
      this.isProcessing = false;
      this.updateTelemetry();
    }
  }

  private async startTask(task: QueueTask): Promise<void> {
    const controller = new AbortController();
    task.abortController = controller;

    this.activeTasks.set(task.id, task);
    if (task.domain) {
      const current = this.domainActiveCount.get(task.domain) || 0;
      this.domainActiveCount.set(task.domain, current + 1);
    }
    this.updateTelemetry();

    try {
      const result = await task.execute(controller.signal);
      this.completedTotal++;
      task.onSuccess?.(result);
    } catch (err: any) {
      if (controller.signal.aborted) {
        return;
      }

      // Check retries with exponential backoff
      const retries = task.retries || 0;
      if (retries < (task.maxRetries || 0)) {
        task.retries = retries + 1;
        const delay = Math.min(1000 * Math.pow(2, retries), 4000);
        setTimeout(() => {
          this.mediumQueue.unshift(task);
          this.pump();
        }, delay);
      } else {
        this.failedTotal++;
        task.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      this.activeTasks.delete(task.id);
      if (task.domain) {
        const current = this.domainActiveCount.get(task.domain) || 1;
        this.domainActiveCount.set(task.domain, Math.max(0, current - 1));
      }
      this.updateTelemetry();
      this.pump();
    }
  }

  private updateTelemetry(): void {
    const queuedCount = this.highQueue.length + this.mediumQueue.length + this.lowQueue.length;
    perfMonitor.setQueueStatus(this.activeTasks.size, queuedCount);
  }

  public getTelemetry(): WorkerQueueTelemetry {
    const queuedCount = this.highQueue.length + this.mediumQueue.length + this.lowQueue.length;
    return {
      activeCount: this.activeTasks.size,
      queuedCount,
      completedCount: this.completedTotal,
      failedCount: this.failedTotal,
      concurrencyLimit: this.concurrencyLimit,
    };
  }
}

export const workerQueue = new WorkerQueue(8);
