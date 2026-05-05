import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DatabaseService } from '../../core/services/database.service';
import { GoogleDriveService } from '../../core/services/google-drive.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-backup',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class BackupComponent implements OnInit {
  importMessage = '';
  importError = false;

  // Google Drive
  driveConnected = false;
  driveBackups: { id: string; name: string; createdTime: string; size: string }[] = [];
  driveLoading = false;
  driveMessage = '';
  driveError = false;
  backingUp = false;

  constructor(
    private dbService: DatabaseService,
    private driveService: GoogleDriveService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.driveConnected = this.driveService.isConnected();
    if (this.driveConnected) {
      this.loadDriveBackups();
    }
  }

  async exportDatabase() {
    const data = await this.dbService.exportDatabase();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `karate-tracker-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.name.endsWith('.json') && !file.name.endsWith('.db')) {
      this.importMessage = 'Please select a valid .json backup file';
      this.importError = true;
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      await this.dbService.importDatabase(data);
      this.importMessage = 'Database restored successfully! Refreshing...';
      this.importError = false;
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      this.importMessage = 'Failed to restore database. The file may be corrupted.';
      this.importError = true;
    }
  }

  // --- Google Drive ---

  async connectDrive() {
    this.driveLoading = true;
    const success = await this.driveService.connect();
    this.driveLoading = false;
    this.driveConnected = success;
    if (success) {
      this.driveMessage = '';
      this.loadDriveBackups();
    } else {
      this.driveMessage = 'Could not connect. Please allow the popup and try again.';
      this.driveError = true;
    }
  }

  disconnectDrive() {
    this.driveService.disconnect();
    this.driveConnected = false;
    this.driveBackups = [];
    this.driveMessage = '';
  }

  async loadDriveBackups() {
    this.driveLoading = true;
    this.driveBackups = await this.driveService.listBackups();
    this.driveLoading = false;
  }

  async backupNow() {
    this.backingUp = true;
    this.driveMessage = '';
    const result = await this.driveService.backup();
    this.backingUp = false;
    if (result.success) {
      this.driveMessage = 'Backup uploaded successfully!';
      this.driveError = false;
      this.loadDriveBackups();
    } else {
      this.driveMessage = result.error || 'Backup failed';
      this.driveError = true;
      this.driveConnected = this.driveService.isConnected();
    }
  }

  async restoreFromDrive(fileId: string, fileName: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Restore from Cloud',
        message: `This will replace ALL current data with "${fileName}". This cannot be undone.`,
        confirmText: 'Restore',
        color: 'warn'
      }
    });

    const confirmed = await dialogRef.afterClosed().toPromise();
    if (!confirmed) return;

    this.driveLoading = true;
    const result = await this.driveService.restoreBackup(fileId);
    this.driveLoading = false;
    if (result.success) {
      this.driveMessage = 'Restored successfully! Refreshing...';
      this.driveError = false;
      setTimeout(() => window.location.reload(), 1500);
    } else {
      this.driveMessage = result.error || 'Restore failed';
      this.driveError = true;
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  formatSize(bytes: string): string {
    const kb = parseInt(bytes, 10) / 1024;
    return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  }
}
