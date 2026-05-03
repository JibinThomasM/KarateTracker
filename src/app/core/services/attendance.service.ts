import { Injectable } from '@angular/core';
import { DatabaseService } from './database.service';
import { DojoService } from './dojo.service';
import { Attendance, AttendanceRecord } from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(private dbService: DatabaseService, private dojoService: DojoService) {}

  private get dojoId(): number {
    return this.dojoService.getSelectedDojoId();
  }

  getByDate(date: string): AttendanceRecord[] {
    return this.dbService.query<AttendanceRecord>(
      `SELECT a.id, a.student_id, s.name as student_name, s.belt_rank, a.date, a.status
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE a.date = ? AND s.dojo_id = ?
       ORDER BY s.name`,
      [date, this.dojoId]
    );
  }

  getByStudent(studentId: number): Attendance[] {
    return this.dbService.query<Attendance>(
      'SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC',
      [studentId]
    );
  }

  markAttendance(studentId: number, date: string, status: 'present' | 'absent'): void {
    this.dbService.run(
      `INSERT OR REPLACE INTO attendance (student_id, date, status) VALUES (?, ?, ?)`,
      [studentId, date, status]
    );
  }

  bulkMarkAttendance(records: { student_id: number; date: string; status: string }[]): void {
    for (const record of records) {
      this.dbService.run(
        `INSERT OR REPLACE INTO attendance (student_id, date, status) VALUES (?, ?, ?)`,
        [record.student_id, record.date, record.status]
      );
    }
  }

  getTodayStats(): { present: number; total: number; taken: boolean } {
    const today = new Date().toISOString().split('T')[0];
    const records = this.getByDate(today);
    const present = records.filter(r => r.status === 'present').length;
    return { present, total: records.length, taken: records.length > 0 };
  }

  getStudentStats(studentId: number): { total: number; present: number; percentage: number } {
    const all = this.dbService.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM attendance WHERE student_id = ?', [studentId]
    );
    const presentResult = this.dbService.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND status = 'present'", [studentId]
    );
    const total = all[0]?.count || 0;
    const present = presentResult[0]?.count || 0;
    return { total, present, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
  }

  isAttendanceTaken(date: string): boolean {
    const result = this.dbService.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE a.date = ? AND s.dojo_id = ?`,
      [date, this.dojoId]
    );
    return (result[0]?.count || 0) > 0;
  }

  getMonthlyReport(monthYear: string): { student_id: number; student_name: string; belt_rank: string; present: number; absent: number; total: number; percentage: number }[] {
    const [year, month] = monthYear.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    return this.dbService.query(
      `SELECT s.id as student_id, s.name as student_name, s.belt_rank,
              SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
              SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
              COUNT(a.id) as total,
              CASE WHEN COUNT(a.id) > 0
                THEN ROUND(SUM(CASE WHEN a.status = 'present' THEN 1.0 ELSE 0 END) / COUNT(a.id) * 100)
                ELSE 0 END as percentage
       FROM students s
       LEFT JOIN attendance a ON a.student_id = s.id AND a.date >= ? AND a.date <= ?
       WHERE s.dojo_id = ? AND s.is_active = 1
       GROUP BY s.id
       ORDER BY s.name`,
      [startDate, endDate, this.dojoId]
    );
  }
}
