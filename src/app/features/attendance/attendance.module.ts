import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DailyAttendanceComponent } from './daily-attendance/daily-attendance.component';
import { MonthlyReportComponent } from './monthly-report/monthly-report.component';

@NgModule({
  declarations: [DailyAttendanceComponent, MonthlyReportComponent],
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    RouterModule.forChild([
      { path: '', component: DailyAttendanceComponent },
      { path: 'monthly', component: MonthlyReportComponent }
    ])
  ]
})
export class AttendanceModule {}
