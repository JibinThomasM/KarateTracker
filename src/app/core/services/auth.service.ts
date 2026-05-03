import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly SESSION_KEY = 'karate_tracker_auth';

  constructor(private dbService: DatabaseService) {}

  isLoggedIn(): boolean {
    return sessionStorage.getItem(this.SESSION_KEY) === 'true';
  }

  async isPasswordSet(): Promise<boolean> {
    const result = this.dbService.query<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'admin_password'"
    );
    return result.length > 0 && !!result[0].value;
  }

  async setPassword(password: string): Promise<void> {
    const hash = await this.hashPassword(password);
    this.dbService.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password', ?)",
      [hash]
    );
  }

  async login(password: string): Promise<boolean> {
    const result = this.dbService.query<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'admin_password'"
    );
    if (result.length === 0 || !result[0].value) {
      return false;
    }
    const hash = await this.hashPassword(password);
    if (hash === result[0].value) {
      sessionStorage.setItem(this.SESSION_KEY, 'true');
      return true;
    }
    return false;
  }

  logout(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
  }

  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
