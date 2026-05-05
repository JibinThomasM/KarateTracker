export interface Attendance {
  id?: string;
  studentId: string;
  dojoId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent';
  studentName: string;
  beltRank: string;
}

export interface AttendanceRecord {
  id?: string;
  studentId: string;
  studentName: string;
  beltRank: string;
  date: string;
  status: 'present' | 'absent';
}
