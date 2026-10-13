/**
 * HiresWay In-App Notification Engine
 *
 * Provides persistent event dispatching and notification tracking across
 * job discovery, applications, outreach reminders, and system alerts.
 */

import { persistentStorageEngine } from '../storage/persistentStorageEngine';
import { userContextService } from '../auth/userContext';

export type NotificationType = 'job_match' | 'application_update' | 'outreach_due' | 'system';
export type NotificationPriority = 'low' | 'normal' | 'high';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  actionUrl?: string;
  metadata?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

class NotificationEngine {
  private notifications: AppNotification[] = [];
  private listeners: Set<(notifications: AppNotification[]) => void> = new Set();
  private isLoaded = false;

  constructor() {
    this.hydrate();
  }

  private async hydrate(): Promise<void> {
    try {
      const items = await persistentStorageEngine.getAll<AppNotification>('notifications');
      const userId = userContextService.getUserId();
      // Scoped to current user
      this.notifications = items.filter((n) => !n.userId || n.userId === userId);
      this.isLoaded = true;
      this.notify();
    } catch (err) {
      console.warn('Failed to hydrate notifications:', err);
      this.isLoaded = true;
    }
  }

  public async getNotifications(): Promise<AppNotification[]> {
    if (!this.isLoaded) {
      await this.hydrate();
    }
    return [...this.notifications];
  }

  public async getUnreadCount(): Promise<number> {
    const list = await this.getNotifications();
    return list.filter((n) => !n.read).length;
  }

  public async send(
    notification: Omit<AppNotification, 'id' | 'userId' | 'read' | 'createdAt'>
  ): Promise<AppNotification> {
    const userId = userContextService.getUserId();
    const item: AppNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId,
      read: false,
      createdAt: new Date().toISOString(),
    };

    this.notifications.unshift(item);
    await persistentStorageEngine.set('notifications', item);
    this.notify();
    return item;
  }

  public async markAsRead(id: string): Promise<void> {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      await persistentStorageEngine.set('notifications', notif);
      this.notify();
    }
  }

  public async markAllAsRead(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const notif of this.notifications) {
      if (!notif.read) {
        notif.read = true;
        promises.push(persistentStorageEngine.set('notifications', notif));
      }
    }
    await Promise.all(promises);
    this.notify();
  }

  public async delete(id: string): Promise<void> {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    await persistentStorageEngine.delete('notifications', id);
    this.notify();
  }

  public subscribe(callback: (notifications: AppNotification[]) => void): () => void {
    this.listeners.add(callback);
    callback([...this.notifications]);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    const items = [...this.notifications];
    this.listeners.forEach((cb) => {
      try {
        cb(items);
      } catch (err) {
        console.error('NotificationEngine listener error:', err);
      }
    });
  }
}

export const notificationEngine = new NotificationEngine();
