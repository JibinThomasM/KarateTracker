import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AttendanceService } from '../../../core/services/attendance.service';
import { DojoService } from '../../../core/services/dojo.service';

@Component({
  selector: 'app-monthly-report',
  templateUrl: './monthly-report.component.html',
  styleUrls: ['./monthly-report.component.scss']
})
export class MonthlyReportComponent implements OnInit, OnDestroy {
  selectedMonth: string;
  report: { studentName: string; beltRank: string; present: number; absent: number; total: number; percentage: number }[] = [];
  totalPresent = 0;
  totalAbsent = 0;
  totalClasses = 0;
  private dojoSub!: Subscription;

  constructor(
    private attendanceService: AttendanceService,
    private dojoService: DojoService
  ) {
    const now = new Date();
    this.selectedMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  ngOnInit() {
    this.dojoSub = this.dojoService.getSelectedDojo$().pipe(filter((id: string) => !!id)).subscribe(() => {
      this.loadReport();
    });
  }

  ngOnDestroy() {
    this.dojoSub.unsubscribe();
  }

  async loadReport() {
    this.report = await this.attendanceService.getMonthlyReport(this.selectedMonth);
    this.totalPresent = this.report.reduce((sum, r) => sum + r.present, 0);
    this.totalAbsent = this.report.reduce((sum, r) => sum + r.absent, 0);
    this.totalClasses = this.report.length > 0 ? this.report[0].total : 0;
  }

  prevMonth() {
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    this.selectedMonth = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    this.loadReport();
  }

  nextMonth() {
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const d = new Date(year, month, 1);
    this.selectedMonth = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    this.loadReport();
  }

  formatMonth(monthYear: string): string {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  getPercentageColor(percentage: number): string {
    if (percentage >= 75) return '#2e7d32';
    if (percentage >= 50) return '#ef6c00';
    return '#c62828';
  }
}
