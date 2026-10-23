/**
 * HiresWay User Context & Isolation Layer
 *
 * Provides current active user identity, session state, and tenant/user scoping.
 * Integrates directly with AuthEngine for cryptographic credentials, session expiration,
 * and user isolation across profiles, applications, and documents.
 */

import { authEngine, UserSession as CoreUserSession } from './authEngine';

export type UserSession = CoreUserSession;

class UserContextService {
  public getSession(): UserSession {
    return authEngine.getSession();
  }

  public getUserId(): string {
    return authEngine.getUserId();
  }

  public isAuthenticated(): boolean {
    return authEngine.isAuthenticated();
  }

  public async login(email: string, pass: string) {
    return authEngine.login(email, pass);
  }

  public async register(params: { email: string; password: string; displayName: string }) {
    return authEngine.register(params);
  }

  public logout(): void {
    authEngine.logout();
  }

  public getRegisteredAccounts() {
    return authEngine.getRegisteredAccounts();
  }

  public subscribe(callback: (session: UserSession) => void): () => void {
    return authEngine.subscribe(callback);
  }
}

export const userContextService = new UserContextService();
