import { Component, OnInit, OnDestroy } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AttendanceService } from '../../../core/services/attendance.service';
import { StudentService } from '../../../core/services/student.service';
import { DojoService } from '../../../core/services/dojo.service';
import { Student } from '../../../core/models/student.model';
import { AttendanceRecord } from '../../../core/models/attendance.model';

interface AttendanceEntry {
  student: Student;
  status: 'present' | 'absent';
}

@Component({
  selector: 'app-daily-attendance',
  templateUrl: './daily-attendance.component.html',
  styleUrls: ['./daily-attendance.component.scss']
})
export class DailyAttendanceComponent implements OnInit, OnDestroy {
  selectedDate: string;
  entries: AttendanceEntry[] = [];
  isMobile = false;
  isSaved = false;
  hasExisting = false;
  private dojoSub!: Subscription;

  constructor(
    private attendanceService: AttendanceService,
    private studentService: StudentService,
    private breakpointObserver: BreakpointObserver,
    private dojoService: DojoService
  ) {
    this.selectedDate = new Date().toISOString().split('T')[0];
  }

  ngOnInit() {
    this.breakpointObserver.observe([Breakpoints.Handset]).subscribe(result => {
      this.isMobile = result.matches;
    });
    this.dojoSub = this.dojoService.getSelectedDojo$().pipe(filter((id: string) => !!id)).subscribe(() => {
      this.loadAttendance();
    });
  }

  ngOnDestroy() {
    this.dojoSub.unsubscribe();
  }

  async loadAttendance() {
    this.isSaved = false;
    const activeStudents = await this.studentService.getActive();
    const existingRecords = await this.attendanceService.getByDate(this.selectedDate);
    this.hasExisting = existingRecords.length > 0;

    const existingMap = new Map<string, string>();
    for (const rec of existingRecords) {
      existingMap.set(rec.studentId, rec.status);
    }

    this.entries = activeStudents.map(student => ({
      student,
      status: (existingMap.get(student.id!) as 'present' | 'absent') || 'absent'
    }));
  }

  onDateChange() {
    this.loadAttendance();
  }

  prevDay() {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() - 1);
    this.selectedDate = d.toISOString().split('T')[0];
    this.loadAttendance();
  }

  nextDay() {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + 1);
    this.selectedDate = d.toISOString().split('T')[0];
    this.loadAttendance();
  }

  toggleStatus(entry: AttendanceEntry) {
    entry.status = entry.status === 'absent' ? 'present' : 'absent';
    this.isSaved = false;
  }

  markAllPresent() {
    this.entries.forEach(e => e.status = 'present');
    this.isSaved = false;
  }

  markAllAbsent() {
    this.entries.forEach(e => e.status = 'absent');
    this.isSaved = false;
  }

  async saveAttendance() {
    const records = this.entries.map(e => ({
      studentId: e.student.id!,
      date: this.selectedDate,
      status: e.status,
      studentName: e.student.name,
      beltRank: e.student.beltRank
    }));
    await this.attendanceService.bulkMarkAttendance(records);
    this.isSaved = true;
    this.hasExisting = true;
  }

  getPresentCount(): number {
    return this.entries.filter(e => e.status === 'present').length;
  }

  isToday(): boolean {
    return this.selectedDate === new Date().toISOString().split('T')[0];
  }
}
