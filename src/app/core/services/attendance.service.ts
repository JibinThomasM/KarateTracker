import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom } from 'rxjs';
import { DojoService } from './dojo.service';
import { StudentService } from './student.service';
import { Attendance, AttendanceRecord } from '../models/attendance.model';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  constructor(
    private afs: AngularFirestore,
    private dojoService: DojoService,
    private studentService: StudentService
  ) {}

  private get dojoId(): string {
    return this.dojoService.getSelectedDojoId();
  }

  async getByDate(date: string): Promise<AttendanceRecord[]> {
    const snapshot = await firstValueFrom(
      this.afs.collection<Attendance>('attendance', ref =>
        ref.where('dojoId', '==', this.dojoId).where('date', '==', date)
      ).get()
    );
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord))
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
  }

  async getByStudent(studentId: string): Promise<Attendance[]> {
    const snapshot = await firstValueFrom(
      this.afs.collection<Attendance>('attendance', ref =>
        ref.where('studentId', '==', studentId)
      ).get()
    );
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.date.localeCompare(a.date));
  }

  async markAttendance(studentId: string, date: string, status: 'present' | 'absent', studentName: string, beltRank: string): Promise<void> {
    const docId = `${studentId}_${date}`;
    await this.afs.doc(`attendance/${docId}`).set({
      studentId,
      dojoId: this.dojoId,
      studentName,
      beltRank,
      date,
      status
    });
  }

  async bulkMarkAttendance(records: { studentId: string; date: string; status: string; studentName: string; beltRank: string }[]): Promise<void> {
    const batch = this.afs.firestore.batch();
    for (const record of records) {
      const docId = `${record.studentId}_${record.date}`;
      const ref = this.afs.doc(`attendance/${docId}`).ref;
      batch.set(ref, {
        studentId: record.studentId,
        dojoId: this.dojoId,
        studentName: record.studentName,
        beltRank: record.beltRank,
        date: record.date,
        status: record.status
      });
    }
    await batch.commit();
  }

  async getTodayStats(): Promise<{ present: number; total: number; taken: boolean }> {
    const today = new Date().toISOString().split('T')[0];
    const records = await this.getByDate(today);
    const present = records.filter(r => r.status === 'present').length;
    return { present, total: records.length, taken: records.length > 0 };
  }

  async getStudentStats(studentId: string): Promise<{ total: number; present: number; percentage: number }> {
    const records = await this.getByStudent(studentId);
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    return { total, present, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
  }

  async isAttendanceTaken(date: string): Promise<boolean> {
    const records = await this.getByDate(date);
    return records.length > 0;
  }

  async getMonthlyReport(monthYear: string): Promise<{ studentId: string; studentName: string; beltRank: string; present: number; absent: number; total: number; percentage: number }[]> {
    const [year, month] = monthYear.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    // Get all attendance records for this dojo, filter by date client-side
    const snapshot = await firstValueFrom(
      this.afs.collection<Attendance>('attendance', ref =>
        ref.where('dojoId', '==', this.dojoId)
      ).get()
    );

    const monthRecords = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(r => r.date >= startDate && r.date <= endDate);

    // Get active students for this dojo
    const students = await this.studentService.getActive();

    // Build report per student
    const attendanceMap = new Map<string, Attendance[]>();
    monthRecords.forEach(data => {
      const list = attendanceMap.get(data.studentId) || [];
      list.push(data);
      attendanceMap.set(data.studentId, list);
    });

    return students.map(s => {
      const records = attendanceMap.get(s.id!) || [];
      const present = records.filter(r => r.status === 'present').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const total = records.length;
      return {
        studentId: s.id!,
        studentName: s.name,
        beltRank: s.beltRank,
        present,
        absent,
        total,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0
      };
    }).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }
}
