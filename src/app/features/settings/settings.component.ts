import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SettingsService } from '../../core/services/settings.service';
import { PaymentService } from '../../core/services/payment.service';
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
    private dojoService: DojoService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadSettings();
  }

  async loadSettings() {
    await this.settingsService.loadSettings();
    this.currency = this.settingsService.get('currency') || '₹';
    this.defaultDueDay = this.settingsService.get('default_due_day') || '5';
    this.whatsappTemplate = this.settingsService.get('whatsapp_template') || '';
    this.feePlans = await this.paymentService.getFeePlans();
    this.dojos = await this.dojoService.getAll();
  }

  private showSaved(key: string) {
    this.savedButton = key;
    setTimeout(() => this.savedButton = '', 2000);
  }

  async saveSettings() {
    await this.settingsService.set('currency', this.currency);
    await this.settingsService.set('default_due_day', this.defaultDueDay);
    await this.settingsService.set('whatsapp_template', this.whatsappTemplate);
  }

  async saveGeneral() {
    await this.saveSettings();
    this.showSaved('general');
  }

  async saveWhatsApp() {
    await this.saveSettings();
    this.showSaved('whatsapp');
  }

  async addFeePlan() {
    if (!this.newPlanName || !this.newPlanAmount) return;
    await this.paymentService.addFeePlan({ name: this.newPlanName, monthlyAmount: this.newPlanAmount, dojoId: this.dojoService.getSelectedDojoId() });
    this.newPlanName = '';
    this.newPlanAmount = null;
    this.feePlans = await this.paymentService.getFeePlans();
    this.showSaved('feePlan');
  }

  deleteFeePlan(id: string) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '340px',
      data: {
        title: 'Delete Fee Plan',
        message: 'Are you sure you want to delete this fee plan?',
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });
    dialogRef.afterClosed().subscribe(async confirmed => {
      if (confirmed) {
        await this.paymentService.deleteFeePlan(id);
        this.feePlans = await this.paymentService.getFeePlans();
      }
    });
  }

  // Dojo CRUD
  async addDojo() {
    if (!this.newDojoName.trim()) return;
    await this.dojoService.add({
      name: this.newDojoName.trim(),
      location: this.newDojoLocation.trim(),
      phone: this.newDojoPhone.trim(),
      isActive: true
    });
    this.newDojoName = '';
    this.newDojoLocation = '';
    this.newDojoPhone = '';
    this.dojos = await this.dojoService.getAll();
    this.showSaved('addDojo');
  }

  startEditDojo(dojo: Dojo) {
    this.editingDojo = { ...dojo };
  }

  async saveEditDojo() {
    if (!this.editingDojo || !this.editingDojo.name.trim()) return;
    await this.dojoService.update(this.editingDojo);
    this.editingDojo = null;
    this.dojos = await this.dojoService.getAll();
    this.showSaved('editDojo');
  }

  cancelEditDojo() {
    this.editingDojo = null;
  }

  async toggleDojoActive(dojo: Dojo) {
    await this.dojoService.toggleActive(dojo.id!, !dojo.isActive);
    this.dojos = await this.dojoService.getAll();
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
    dialogRef.afterClosed().subscribe(async confirmed => {
      if (confirmed) {
        await this.dojoService.delete(dojo.id!);
        this.dojos = await this.dojoService.getAllIncludingInactive();
      }
    });
  }
}
