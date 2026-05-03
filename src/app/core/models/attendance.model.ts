export interface Attendance {
  id?: number;
  student_id: number;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent';
}

export interface AttendanceRecord {
  id?: number;
  student_id: number;
  student_name: string;
  belt_rank: string;
  date: string;
  status: 'present' | 'absent';
}
