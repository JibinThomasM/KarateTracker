import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom } from 'rxjs';

const SETTINGS_DOC = 'settings/config';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private cache: Record<string, string> = {};
  private loaded = false;

  constructor(private afs: AngularFirestore) {}

  async loadSettings(): Promise<void> {
    if (this.loaded) return;
    const doc = await firstValueFrom(this.afs.doc<Record<string, string>>(SETTINGS_DOC).get());
    this.cache = doc.exists ? doc.data()! : {};
    this.loaded = true;
  }

  get(key: string): string | null {
    return this.cache[key] || null;
  }

  async set(key: string, value: string): Promise<void> {
    this.cache[key] = value;
    await this.afs.doc(SETTINGS_DOC).set(this.cache, { merge: true });
  }

  async getAll(): Promise<{ key: string; value: string }[]> {
    await this.loadSettings();
    return Object.entries(this.cache)
      .filter(([k]) => k !== 'adminPassword' && k !== 'schemaVersion')
      .map(([key, value]) => ({ key, value }));
  }
}
