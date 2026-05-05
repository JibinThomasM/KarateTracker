import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { StudentService } from '../../core/services/student.service';
import { AttendanceService } from '../../core/services/attendance.service';
import { PaymentService } from '../../core/services/payment.service';
import { SettingsService } from '../../core/services/settings.service';
import { DojoService } from '../../core/services/dojo.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  activeStudents = 0;
  attendanceToday = { present: 0, total: 0, taken: false };
  overdueCount = 0;
  overdueAmount = 0;
  monthlyCollection = 0;
  currency = '₹';
  dojoName = 'My Karate Class';
  private dojoSub!: Subscription;

  constructor(
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private paymentService: PaymentService,
    private settingsService: SettingsService,
    private dojoService: DojoService,
    public router: Router
  ) {}

  ngOnInit() {
    this.dojoSub = this.dojoService.getSelectedDojo$().subscribe(() => {
      this.loadData();
    });
  }

  ngOnDestroy() {
    this.dojoSub.unsubscribe();
  }

  async loadData() {
    await this.settingsService.loadSettings();
    const selectedDojo = await this.dojoService.getById(this.dojoService.getSelectedDojoId());
    this.dojoName = selectedDojo?.name || this.settingsService.get('dojo_name') || 'My Karate Class';
    this.currency = this.settingsService.get('currency') || '₹';
    this.activeStudents = await this.studentService.getCount();
    this.attendanceToday = await this.attendanceService.getTodayStats();
    await this.paymentService.updateOverdueStatuses();
    this.overdueCount = await this.paymentService.getOverdueCount();
    this.overdueAmount = await this.paymentService.getOverdueTotalAmount();
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    this.monthlyCollection = await this.paymentService.getMonthlyCollection(monthYear);
  }

  goToAttendance() {
    this.router.navigate(['/attendance']);
  }

  goToOverdue() {
    this.router.navigate(['/payments'], { queryParams: { filter: 'overdue' } });
  }
}
