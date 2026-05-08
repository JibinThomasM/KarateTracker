import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DatabaseService } from '../../core/services/database.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-backup',
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class BackupComponent {
  importMessage = '';
  importError = false;

  constructor(
    private dbService: DatabaseService,
    private dialog: MatDialog
  ) {}

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
}
