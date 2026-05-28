import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { PaymentService } from '../../../core/services/payment.service';
import { WhatsappService } from '../../../core/services/whatsapp.service';
import { SettingsService } from '../../../core/services/settings.service';
import { DojoService } from '../../../core/services/dojo.service';
import { PaymentRecord, Reminder } from '../../../core/models/payment.model';
import { AlertDialogComponent } from '../../../shared/alert-dialog/alert-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-payment-list',
  templateUrl: './payment-list.component.html',
  styleUrls: ['./payment-list.component.scss']
})
export class PaymentListComponent implements OnInit, OnDestroy {
  payments: PaymentRecord[] = [];
  selectedMonth: string;
  statusFilter = '';
  isMobile = false;
  currency = '₹';
  displayedColumns = ['studentName', 'amountDue', 'amountPaid', 'dueDate', 'status', 'actions'];
  reminderMap = new Map<string, Reminder>();
  sendingAll = false;
  sendProgress = { current: 0, total: 0 };
  private dojoSub!: Subscription;

  constructor(
    private paymentService: PaymentService,
    private whatsappService: WhatsappService,
    private settingsService: SettingsService,
    private dojoService: DojoService,
    private route: ActivatedRoute,
    private breakpointObserver: BreakpointObserver,
    private dialog: MatDialog
  ) {
    const now = new Date();
    this.selectedMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  ngOnInit() {
    this.breakpointObserver.observe([Breakpoints.Handset]).subscribe(result => {
      this.isMobile = result.matches;
    });
    this.currency = this.settingsService.get('currency') || '₹';

    this.route.queryParams.subscribe(params => {
      if (params['filter'] === 'overdue') {
        this.statusFilter = 'overdue';
      }
      this.loadPayments();
    });

    this.dojoSub = this.dojoService.getSelectedDojo$().pipe(filter((id: string) => !!id)).subscribe(() => {
      this.loadPayments();
    });
  }

  ngOnDestroy() {
    this.dojoSub.unsubscribe();
  }

  async loadPayments() {
    await this.settingsService.loadSettings();
    this.currency = this.settingsService.get('currency') || '₹';
    await this.paymentService.updateOverdueStatuses();
    if (this.statusFilter === 'overdue') {
      this.payments = await this.paymentService.getOverduePayments();
    } else {
      this.payments = await this.paymentService.getPayments(
        this.selectedMonth || undefined,
        this.statusFilter || undefined
      );
    }
    const month = this.statusFilter === 'overdue' ? undefined : this.selectedMonth;
    if (month) {
      this.reminderMap = await this.paymentService.getRemindersByMonth(month);
    } else {
      // For overdue view, load reminders for all visible payment months
      this.reminderMap = new Map();
      const months = new Set(this.payments.map(p => p.monthYear));
      for (const m of months) {
        const map = await this.paymentService.getRemindersByMonth(m);
        map.forEach((v, k) => this.reminderMap.set(k, v));
      }
    }
  }

  onFilterChange() {
    this.loadPayments();
  }

  prevMonth() {
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    this.selectedMonth = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    this.loadPayments();
  }

  nextMonth() {
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const d = new Date(year, month, 1);
    this.selectedMonth = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    this.loadPayments();
  }

  async markPaid(payment: PaymentRecord) {
    await this.paymentService.markPaid(payment.id!, payment.amountDue);
    await this.loadPayments();
  }

  sendWhatsappReminder(payment: PaymentRecord) {
    const whatsappNum = payment.whatsappNumber || '';
    if (!whatsappNum) {
      this.dialog.open(AlertDialogComponent, {
        width: '340px',
        data: {
          title: 'No WhatsApp Number',
          message: 'No WhatsApp number set for this student.',
          icon: 'warning',
          color: 'accent'
        }
      });
      return;
    }
    const overdueAmount = payment.amountDue - payment.amountPaid;
    const url = this.whatsappService.buildReminderUrl(
      whatsappNum, payment.studentName, overdueAmount, payment.monthYear
    );
    window.open(url, '_blank');
    this.paymentService.recordReminder(payment).then(() => {
      this.reminderMap.set(payment.id!, {
        paymentId: payment.id!,
        studentId: payment.studentId,
        dojoId: payment.dojoId,
        studentName: payment.studentName,
        whatsappNumber: payment.whatsappNumber,
        sentAt: new Date().toISOString(),
        monthYear: payment.monthYear
      });
    });
  }

  getUnpaidWithPhone(): PaymentRecord[] {
    return this.payments.filter(p => p.status !== 'paid' && p.whatsappNumber?.trim());
  }

  async sendAllReminders() {
    const unpaid = this.getUnpaidWithPhone();
    if (unpaid.length === 0) {
      this.dialog.open(AlertDialogComponent, {
        width: '340px',
        data: {
          title: 'No Reminders to Send',
          message: 'No unpaid students with WhatsApp numbers found.',
          icon: 'info',
          color: 'primary'
        }
      });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      data: {
        title: 'Send All Reminders',
        message: `This will open ${unpaid.length} WhatsApp reminder(s) one by one. Send each message and come back to open the next one.`,
        confirmText: 'Start Sending',
        color: 'primary'
      }
    });

    const confirmed = await dialogRef.afterClosed().toPromise();
    if (!confirmed) return;

    this.sendingAll = true;
    this.sendProgress = { current: 0, total: unpaid.length };

    for (const payment of unpaid) {
      this.sendProgress.current++;
      const overdueAmount = payment.amountDue - payment.amountPaid;
      const url = this.whatsappService.buildReminderUrl(
        payment.whatsappNumber, payment.studentName, overdueAmount, payment.monthYear
      );
      window.open(url, '_blank');
      await this.paymentService.recordReminder(payment);
      this.reminderMap.set(payment.id!, {
        paymentId: payment.id!,
        studentId: payment.studentId,
        dojoId: payment.dojoId,
        studentName: payment.studentName,
        whatsappNumber: payment.whatsappNumber,
        sentAt: new Date().toISOString(),
        monthYear: payment.monthYear
      });
      // Wait 2 seconds between each to give user time
      if (this.sendProgress.current < unpaid.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    this.sendingAll = false;
    this.dialog.open(AlertDialogComponent, {
      width: '340px',
      data: {
        title: 'Reminders Sent',
        message: `Opened ${unpaid.length} WhatsApp reminder(s). Make sure you sent each message in WhatsApp.`,
        icon: 'check_circle',
        color: 'primary'
      }
    });
  }

  getLastReminderDate(paymentId: string): string | null {
    const reminder = this.reminderMap.get(paymentId);
    if (!reminder) return null;
    const d = new Date(reminder.sentAt);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  async generateFees() {
    if (!this.selectedMonth) return;
    try {
      const count = await this.paymentService.generateMonthlyFees(this.selectedMonth);
      await this.loadPayments();
      if (count > 0) {
        this.dialog.open(AlertDialogComponent, {
          width: '340px',
          data: {
            title: 'Fees Generated',
            message: `Generated ${count} payment records for ${this.formatMonth(this.selectedMonth)}.`,
            icon: 'check_circle',
            color: 'primary'
          }
        });
      } else {
        this.dialog.open(AlertDialogComponent, {
          width: '340px',
          data: {
            title: 'No Records Generated',
            message: 'No students have fee plans assigned. Edit each student and select a fee plan first.',
            icon: 'info',
            color: 'primary'
          }
        });
      }
    } catch (e: any) {
      this.dialog.open(AlertDialogComponent, {
        width: '340px',
        data: {
          title: 'Error',
          message: e.message || 'Failed to generate fees.',
          icon: 'error',
          color: 'warn'
        }
      });
    }
  }

  formatMonth(monthYear: string): string {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'paid': return '#2e7d32';
      case 'overdue': return '#c62828';
      default: return '#ef6c00';
    }
  }
}
