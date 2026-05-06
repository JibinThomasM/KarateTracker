import { Component, OnInit } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DojoService } from '../../core/services/dojo.service';
import { SettingsService } from '../../core/services/settings.service';
import { GoogleDriveService } from '../../core/services/google-drive.service';
import { Dojo } from '../../core/models/dojo.model';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss']
})
export class ShellComponent implements OnInit {
  isMobile = false;
  sidenavOpened = false;
  dojos: Dojo[] = [];
  selectedDojoId = '';

  navItems = [
    { icon: 'dashboard', label: 'Dashboard', route: '/dashboard' },
    { icon: 'people', label: 'Students', route: '/students' },
    { icon: 'fact_check', label: 'Attendance', route: '/attendance' },
    { icon: 'payments', label: 'Payments', route: '/payments' },
  ];

  moreItems = [
    { icon: 'settings', label: 'Settings', route: '/settings' },
    { icon: 'backup', label: 'Backup', route: '/backup' },
  ];

  constructor(
    private breakpointObserver: BreakpointObserver,
    private authService: AuthService,
    private dojoService: DojoService,
    private settingsService: SettingsService,
    private driveService: GoogleDriveService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.breakpointObserver.observe([Breakpoints.Handset]).subscribe(result => {
      this.isMobile = result.matches;
      if (!this.isMobile) {
        this.sidenavOpened = true;
      }
    });
    await this.settingsService.loadSettings();
    await this.dojoService.initSelection();
    await this.loadDojos();
    this.dojoService.getSelectedDojo$().subscribe(id => {
      this.selectedDojoId = id;
    });
    this.triggerAutoBackup();
  }

  async loadDojos() {
    this.dojos = await this.dojoService.getAll();
    this.selectedDojoId = this.dojoService.getSelectedDojoId();
  }

  onDojoChange(dojoId: string) {
    this.dojoService.selectDojo(dojoId);
  }

  toggleSidenav() {
    this.sidenavOpened = !this.sidenavOpened;
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }

  private triggerAutoBackup(): void {
    if (this.driveService.needsBackupToday()) {
      this.driveService.backup().then(result => {
        if (!result.success) {
          console.warn('Auto-backup failed:', result.error);
        } else {
          console.log('Auto-backup to Google Drive completed');
        }
      });
    }
  }
}
