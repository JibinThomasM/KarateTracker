import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface AlertDialogData {
  title: string;
  message: string;
  buttonText?: string;
  icon?: string;
  color?: string;
}

@Component({
  selector: 'app-alert-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon *ngIf="data.icon" class="title-icon" [style.color]="iconColor">{{ data.icon }}</mat-icon>
      {{ data.title }}
    </h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button [color]="data.color || 'primary'" (click)="close()">
        {{ data.buttonText || 'OK' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      margin: 0;
      font-size: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .title-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    p { margin: 8px 0; color: #555; font-size: 15px; line-height: 1.5; }
    mat-dialog-actions { padding-top: 12px; }
  `]
})
export class AlertDialogComponent {
  get iconColor(): string {
    switch (this.data.color) {
      case 'warn': return '#c62828';
      case 'accent': return '#ff8f00';
      default: return '#1a237e';
    }
  }

  constructor(
    public dialogRef: MatDialogRef<AlertDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AlertDialogData
  ) {}

  close() {
    this.dialogRef.close();
  }
}
