import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  constructor(private dbService: DatabaseService) {}

  get(key: string): string | null {
    const result = this.dbService.query<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return result[0]?.value || null;
  }

  set(key: string, value: string): void {
    this.dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  getAll(): { key: string; value: string }[] {
    return this.dbService.query<{ key: string; value: string }>(
      "SELECT key, value FROM settings WHERE key != 'admin_password' AND key != 'schema_version' ORDER BY key"
    );
  }
}
