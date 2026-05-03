import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GoogleDriveService } from '../../core/services/google-drive.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  password = '';
  confirmPassword = '';
  isFirstTime = false;
  error = '';
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private driveService: GoogleDriveService
  ) {}

  async ngOnInit() {
    this.isFirstTime = !(await this.authService.isPasswordSet());
  }

  async onSubmit() {
    this.error = '';
    this.loading = true;

    try {
      if (this.isFirstTime) {
        if (this.password.length < 4) {
          this.error = 'Password must be at least 4 characters';
          this.loading = false;
          return;
        }
        if (this.password !== this.confirmPassword) {
          this.error = 'Passwords do not match';
          this.loading = false;
          return;
        }
        await this.authService.setPassword(this.password);
        await this.authService.login(this.password);
        this.router.navigate(['/dashboard']);
        this.triggerAutoBackup();
      } else {
        const success = await this.authService.login(this.password);
        if (success) {
          this.router.navigate(['/dashboard']);
          this.triggerAutoBackup();
        } else {
          this.error = 'Incorrect password';
        }
      }
    } catch (e) {
      this.error = 'An error occurred. Please try again.';
    }
    this.loading = false;
  }

  /** Silent auto-backup to Google Drive on first login of the day */
  private triggerAutoBackup(): void {
    if (this.driveService.needsBackupToday()) {
      this.driveService.backup().then(result => {
        if (!result.success) {
          console.warn('Auto-backup failed:', result.error);
        }
      });
    }
  }
}
