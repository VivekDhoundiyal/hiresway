/**
 * CareerOs Centralized Visibility-Aware Background Sync Manager
 *
 * Automatically manages scheduled background jobs, pausing execution when the
 * browser tab is hidden (document.visibilityState === 'hidden') and resuming
 * immediately upon tab focus. Prevents overlapping executions and memory leaks.
 */

export interface ScheduledTask {
  name: string;
  intervalMs: number;
  taskFn: () => Promise<void> | void;
  lastExecutedAt?: number;
  isRunning: boolean;
  timerId?: any;
}

class BackgroundSyncManager {
  private tasks: Map<string, ScheduledTask> = new Map();
  private isTabVisible = true;

  constructor() {
    this.initVisibilityListener();
  }

  private initVisibilityListener(): void {
    if (typeof document === 'undefined') return;

    this.isTabVisible = document.visibilityState === 'visible';

    document.addEventListener('visibilitychange', () => {
      const nowVisible = document.visibilityState === 'visible';
      if (nowVisible !== this.isTabVisible) {
        this.isTabVisible = nowVisible;
        if (this.isTabVisible) {
          // Tab regained focus: resume tasks and run any overdue ones
          this.resumeAllTasks();
        } else {
          // Tab hidden: pause background timers to conserve CPU & memory
          this.pauseAllTasks();
        }
      }
    });
  }

  public registerTask(
    name: string,
    intervalMs: number,
    taskFn: () => Promise<void> | void
  ): () => void {
    // Clean existing if any
    this.unregisterTask(name);

    const task: ScheduledTask = {
      name,
      intervalMs,
      taskFn,
      isRunning: false,
    };

    this.tasks.set(name, task);

    if (this.isTabVisible) {
      this.startTaskTimer(task);
    }

    return () => this.unregisterTask(name);
  }

  public unregisterTask(name: string): void {
    const task = this.tasks.get(name);
    if (task && task.timerId) {
      clearInterval(task.timerId);
      task.timerId = undefined;
    }
    this.tasks.delete(name);
  }

  private startTaskTimer(task: ScheduledTask): void {
    if (task.timerId) {
      clearInterval(task.timerId);
    }

    task.timerId = setInterval(async () => {
      if (!this.isTabVisible || task.isRunning) return;
      task.isRunning = true;
      try {
        await task.taskFn();
        task.lastExecutedAt = Date.now();
      } catch (e) {
        console.error(`Background task [${task.name}] failed:`, e);
      } finally {
        task.isRunning = false;
      }
    }, task.intervalMs);
  }

  private pauseAllTasks(): void {
    this.tasks.forEach((task) => {
      if (task.timerId) {
        clearInterval(task.timerId);
        task.timerId = undefined;
      }
    });
  }

  private resumeAllTasks(): void {
    const now = Date.now();
    this.tasks.forEach((task) => {
      this.startTaskTimer(task);
      // If overdue while tab was hidden, trigger immediate run
      const timeSinceLast = task.lastExecutedAt ? now - task.lastExecutedAt : Infinity;
      if (timeSinceLast >= task.intervalMs && !task.isRunning) {
        task.isRunning = true;
        Promise.resolve(task.taskFn())
          .catch((e) => console.error(`Resumed task [${task.name}] error:`, e))
          .finally(() => {
            task.isRunning = false;
            task.lastExecutedAt = Date.now();
          });
      }
    });
  }

  public isVisible(): boolean {
    return this.isTabVisible;
  }
}

export const backgroundSyncManager = new BackgroundSyncManager();
