import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom } from 'rxjs';

/**
 * Repurposed DatabaseService — now handles JSON backup/restore for Google Drive.
 * No longer manages sql.js or IndexedDB.
 */
@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly collections = ['dojos', 'students', 'attendance', 'payments', 'feePlans', 'settings', 'reminders'];

  constructor(private afs: AngularFirestore) {}

  /** Export all Firestore data as JSON bytes (Uint8Array) for Google Drive backup */
  async exportDatabase(): Promise<Uint8Array> {
    const data: Record<string, any[]> = {};

    for (const col of this.collections) {
      if (col === 'settings') {
        const doc = await firstValueFrom(this.afs.doc('settings/config').get());
        data[col] = doc.exists ? [{ id: 'config', ...doc.data() as object }] : [];
      } else {
        const snapshot = await firstValueFrom(this.afs.collection(col).get());
        data[col] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as object }));
      }
    }

    const json = JSON.stringify(data, null, 2);
    return new TextEncoder().encode(json);
  }

  /** Import JSON bytes (from Google Drive backup) into Firestore, replacing all data */
  async importDatabase(bytes: Uint8Array): Promise<void> {
    const json = new TextDecoder().decode(bytes);
    const data: Record<string, any[]> = JSON.parse(json);

    for (const col of this.collections) {
      if (!data[col]) continue;

      if (col === 'settings') {
        const items = data[col];
        if (items.length > 0) {
          const { id, ...fields } = items[0];
          await this.afs.doc('settings/config').set(fields);
        }
      } else {
        // Delete existing docs in collection
        const existing = await firstValueFrom(this.afs.collection(col).get());
        const deleteBatch = this.afs.firestore.batch();
        existing.docs.forEach(doc => deleteBatch.delete(doc.ref));
        if (existing.docs.length > 0) await deleteBatch.commit();

        // Write new docs in batches of 500
        const items = data[col];
        for (let i = 0; i < items.length; i += 500) {
          const batch = this.afs.firestore.batch();
          const chunk = items.slice(i, i + 500);
          for (const item of chunk) {
            const { id, ...fields } = item;
            const ref = this.afs.collection(col).doc(id).ref;
            batch.set(ref, fields);
          }
          await batch.commit();
        }
      }
    }
  }

  isInitialized(): boolean {
    return true;
  }
}
