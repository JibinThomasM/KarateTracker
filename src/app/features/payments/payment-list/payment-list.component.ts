import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { PaymentService } from '../../../core/services/payment.service';
import { WhatsappService } from '../../../core/services/whatsapp.service';
import { SettingsService } from '../../../core/services/settings.service';
import { DojoService } from '../../../core/services/dojo.service';
import { PaymentRecord } from '../../../core/models/payment.model';
import { AlertDialogComponent } from '../../../shared/alert-dialog/alert-dialog.component';

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
  displayedColumns = ['student_name', 'amount_due', 'amount_paid', 'due_date', 'status', 'actions'];
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

    this.dojoSub = this.dojoService.getSelectedDojo$().subscribe(() => {
      this.loadPayments();
    });
  }

  ngOnDestroy() {
    this.dojoSub.unsubscribe();
  }

  loadPayments() {
    this.paymentService.updateOverdueStatuses();
    if (this.statusFilter === 'overdue') {
      this.payments = this.paymentService.getOverduePayments();
    } else {
      this.payments = this.paymentService.getPayments(
        this.selectedMonth || undefined,
        this.statusFilter || undefined
      );
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

  markPaid(payment: PaymentRecord) {
    this.paymentService.markPaid(payment.id!, payment.amount_due);
    this.loadPayments();
  }

  sendWhatsappReminder(payment: PaymentRecord) {
    const whatsappNum = payment.whatsapp_number || '';
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
    const overdueAmount = payment.amount_due - payment.amount_paid;
    const url = this.whatsappService.buildReminderUrl(
      whatsappNum, payment.student_name, overdueAmount, payment.month_year
    );
    window.open(url, '_blank');
  }

  generateFees() {
    if (!this.selectedMonth) return;
    const count = this.paymentService.generateMonthlyFees(this.selectedMonth);
    this.loadPayments();
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
          message: 'All active students already have entries for this month.',
          icon: 'info',
          color: 'primary'
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
