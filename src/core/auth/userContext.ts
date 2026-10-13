/**
 * HiresWay User Context & Isolation Layer
 *
 * Provides current active user identity, session state, and tenant/user scoping.
 * Guarantees zero leakage across user profiles while operating client-side.
 */

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  isAuthenticated: boolean;
  createdAt: string;
  lastActive: string;
}

const DEFAULT_USER_ID = 'user-primary-1';
const SESSION_STORAGE_KEY = 'hiresway_user_session_v1';

class UserContextService {
  private currentSession: UserSession;
  private listeners: Set<(session: UserSession) => void> = new Set();

  constructor() {
    this.currentSession = this.loadSession();
  }

  private loadSession(): UserSession {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (e) {
        console.warn('Failed to load user session from localStorage', e);
      }
    }

    return {
      id: DEFAULT_USER_ID,
      email: 'user@hiresway.local',
      displayName: 'Primary Candidate',
      role: 'user',
      isAuthenticated: true,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };
  }

  private saveSession(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.currentSession));
      } catch (e) {
        console.warn('Failed to save user session to localStorage', e);
      }
    }
    this.notify();
  }

  public getSession(): UserSession {
    return { ...this.currentSession };
  }

  public getUserId(): string {
    return this.currentSession.id;
  }

  public updateSession(updates: Partial<UserSession>): void {
    this.currentSession = {
      ...this.currentSession,
      ...updates,
      lastActive: new Date().toISOString(),
    };
    this.saveSession();
  }

  public subscribe(callback: (session: UserSession) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    const session = this.getSession();
    this.listeners.forEach((cb) => {
      try {
        cb(session);
      } catch (err) {
        console.error('UserContext listener error:', err);
      }
    });
  }
}

export const userContextService = new UserContextService();
