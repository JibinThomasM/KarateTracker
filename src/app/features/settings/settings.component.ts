import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SettingsService } from '../../core/services/settings.service';
import { PaymentService } from '../../core/services/payment.service';
import { AuthService } from '../../core/services/auth.service';
import { DojoService } from '../../core/services/dojo.service';
import { FeePlan } from '../../core/models/payment.model';
import { Dojo } from '../../core/models/dojo.model';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  currency = '';
  defaultDueDay = '';
  whatsappTemplate = '';
  feePlans: FeePlan[] = [];
  newPlanName = '';
  newPlanAmount: number | null = null;
  newPassword = '';
  confirmNewPassword = '';
  passwordMessage = '';
  savedButton = '';

  // Dojo management
  dojos: Dojo[] = [];
  newDojoName = '';
  newDojoLocation = '';
  newDojoPhone = '';
  editingDojo: Dojo | null = null;

  constructor(
    private settingsService: SettingsService,
    private paymentService: PaymentService,
    private authService: AuthService,
    private dojoService: DojoService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    this.currency = this.settingsService.get('currency') || '₹';
    this.defaultDueDay = this.settingsService.get('default_due_day') || '5';
    this.whatsappTemplate = this.settingsService.get('whatsapp_template') || '';
    this.feePlans = this.paymentService.getFeePlans();
    this.dojos = this.dojoService.getAll();
  }

  private showSaved(key: string) {
    this.savedButton = key;
    setTimeout(() => this.savedButton = '', 2000);
  }

  saveSettings() {
    this.settingsService.set('currency', this.currency);
    this.settingsService.set('default_due_day', this.defaultDueDay);
    this.settingsService.set('whatsapp_template', this.whatsappTemplate);
  }

  saveGeneral() {
    this.saveSettings();
    this.showSaved('general');
  }

  saveWhatsApp() {
    this.saveSettings();
    this.showSaved('whatsapp');
  }

  addFeePlan() {
    if (!this.newPlanName || !this.newPlanAmount) return;
    this.paymentService.addFeePlan({ name: this.newPlanName, monthly_amount: this.newPlanAmount, dojo_id: 0 });
    this.newPlanName = '';
    this.newPlanAmount = null;
    this.feePlans = this.paymentService.getFeePlans();
    this.showSaved('feePlan');
  }

  deleteFeePlan(id: number) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '340px',
      data: {
        title: 'Delete Fee Plan',
        message: 'Are you sure you want to delete this fee plan?',
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.paymentService.deleteFeePlan(id);
        this.feePlans = this.paymentService.getFeePlans();
      }
    });
  }

  // Dojo CRUD
  addDojo() {
    if (!this.newDojoName.trim()) return;
    this.dojoService.add({
      name: this.newDojoName.trim(),
      location: this.newDojoLocation.trim(),
      phone: this.newDojoPhone.trim(),
      is_active: 1
    });
    this.newDojoName = '';
    this.newDojoLocation = '';
    this.newDojoPhone = '';
    this.dojos = this.dojoService.getAll();
    this.showSaved('addDojo');
  }

  startEditDojo(dojo: Dojo) {
    this.editingDojo = { ...dojo };
  }

  saveEditDojo() {
    if (!this.editingDojo || !this.editingDojo.name.trim()) return;
    this.dojoService.update(this.editingDojo);
    this.editingDojo = null;
    this.dojos = this.dojoService.getAll();
    this.showSaved('editDojo');
  }

  cancelEditDojo() {
    this.editingDojo = null;
  }

  toggleDojoActive(dojo: Dojo) {
    this.dojoService.toggleActive(dojo.id!, dojo.is_active ? false : true);
    this.dojos = this.dojoService.getAll();
  }

  deleteDojo(dojo: Dojo) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '340px',
      data: {
        title: 'Delete Dojo',
        message: `Are you sure you want to permanently delete "${dojo.name}"? All students, attendance and payment records under this dojo will also be deleted.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.dojoService.delete(dojo.id!);
        this.dojos = this.dojoService.getAllIncludingInactive();
      }
    });
  }

  async changePassword() {
    this.passwordMessage = '';
    if (this.newPassword.length < 4) {
      this.passwordMessage = 'Password must be at least 4 characters';
      return;
    }
    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordMessage = 'Passwords do not match';
      return;
    }
    await this.authService.setPassword(this.newPassword);
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.passwordMessage = 'Password changed successfully!';
    this.showSaved('password');
  }
}
