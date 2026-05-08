import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';

const CLIENT_ID = '937909695116-lj09a2rcc0f448454j4oftl2s0dm81pu.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'KarateTrackerBackups';
const LAST_BACKUP_KEY = 'karate_tracker_last_gdrive_backup';
const GDRIVE_TOKEN_KEY = 'karate_tracker_gdrive_token';
const MAX_BACKUPS = 7;

@Injectable({ providedIn: 'root' })
export class GoogleDriveService {
  private accessToken: string | null = null;

  constructor(private dbService: DatabaseService) {
    this.accessToken = localStorage.getItem(GDRIVE_TOKEN_KEY);
  }

  isConnected(): boolean {
    return !!this.accessToken;
  }

  /** OAuth2 implicit flow — opens Google sign-in popup */
  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      const redirectUri = window.location.origin + window.location.pathname;
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth' +
        `?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&prompt=consent`;

      const popup = window.open(authUrl, 'google-auth', 'width=500,height=600');
      if (!popup) {
        resolve(false);
        return;
      }

      const timer = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(timer);
            resolve(false);
            return;
          }
          const popupUrl = popup.location.href;
          if (popupUrl.includes('access_token=')) {
            const hash = popup.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const token = params.get('access_token');
            popup.close();
            clearInterval(timer);
            if (token) {
              this.accessToken = token;
              localStorage.setItem(GDRIVE_TOKEN_KEY, token);
              resolve(true);
            } else {
              resolve(false);
            }
          }
        } catch {
          // Cross-origin — popup still on Google's domain, keep waiting
        }
      }, 500);
    });
  }

  disconnect(): void {
    this.accessToken = null;
    localStorage.removeItem(GDRIVE_TOKEN_KEY);
    localStorage.removeItem(LAST_BACKUP_KEY);
  }

  /** Check if we need a backup today (first login of the day) */
  needsBackupToday(): boolean {
    if (!this.isConnected()) return false;
    const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
    const today = new Date().toISOString().split('T')[0];
    return lastBackup !== today;
  }

  /** Verify the stored token is still valid */
  async isTokenValid(): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      if (res.status === 401 || res.status === 403) {
        this.disconnect();
        return false;
      }
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Upload current DB to Google Drive */
  async backup(): Promise<{ success: boolean; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'Not connected to Google Drive' };
    }

    try {
      // Get or create backup folder
      const folderId = await this.getOrCreateFolder();

      // Export database
      const data = await this.dbService.exportDatabase();
      const now = new Date();
      const fileName = `backup-${now.toISOString().replace(/[:.]/g, '-')}.json`;

      // Upload file
      const metadata = {
        name: fileName,
        parents: [folderId],
        mimeType: 'application/json'
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([data], { type: 'application/json' }));

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}` },
        body: form
      });

      if (res.status === 401) {
        this.disconnect();
        return { success: false, error: 'Session expired. Please reconnect Google Drive.' };
      }

      if (!res.ok) {
        return { success: false, error: `Upload failed (${res.status})` };
      }

      // Mark today as backed up
      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString().split('T')[0]);

      // Clean up old backups
      await this.cleanupOldBackups(folderId);

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Backup failed' };
    }
  }

  /** List backups from Google Drive */
  async listBackups(): Promise<{ id: string; name: string; createdTime: string; size: string }[]> {
    if (!this.accessToken) return [];

    try {
      const folderId = await this.getOrCreateFolder();
      const query = `'${folderId}' in parents and trashed = false`;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (res.status === 401) {
        this.disconnect();
        return [];
      }

      if (!res.ok) return [];
      const data = await res.json();
      return data.files || [];
    } catch {
      return [];
    }
  }

  /** Download a specific backup and restore it */
  async restoreBackup(fileId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'Not connected to Google Drive' };
    }

    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (res.status === 401) {
        this.disconnect();
        return { success: false, error: 'Session expired. Please reconnect Google Drive.' };
      }

      if (!res.ok) {
        return { success: false, error: `Download failed (${res.status})` };
      }

      const buffer = await res.arrayBuffer();
      await this.dbService.importDatabase(new Uint8Array(buffer));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Restore failed' };
    }
  }

  /** Find or create the backup folder */
  private async getOrCreateFolder(): Promise<string> {
    // Search for existing folder
    const query = `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // Create folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    const folder = await createRes.json();
    return folder.id;
  }

  /** Delete old backups, keep only MAX_BACKUPS */
  private async cleanupOldBackups(folderId: string): Promise<void> {
    const backups = await this.listBackups();
    if (backups.length <= MAX_BACKUPS) return;

    const toDelete = backups.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
    }
  }
}
