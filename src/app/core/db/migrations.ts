export const SCHEMA_VERSION = 2;

export const MIGRATIONS: { version: number; sql: string[] }[] = [
  {
    version: 1,
    sql: [
      `CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        belt_rank TEXT NOT NULL DEFAULT 'White',
        phone TEXT NOT NULL DEFAULT '',
        whatsapp_number TEXT NOT NULL DEFAULT '',
        join_date TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'excused')),
        FOREIGN KEY (student_id) REFERENCES students(id),
        UNIQUE(student_id, date)
      )`,
      `CREATE TABLE IF NOT EXISTS fee_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        monthly_amount REAL NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS student_fee_plan (
        student_id INTEGER NOT NULL,
        fee_plan_id INTEGER NOT NULL,
        PRIMARY KEY (student_id),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (fee_plan_id) REFERENCES fee_plans(id)
      )`,
      `CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        month_year TEXT NOT NULL,
        amount_due REAL NOT NULL DEFAULT 0,
        amount_paid REAL NOT NULL DEFAULT 0,
        due_date TEXT NOT NULL,
        paid_date TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue')),
        FOREIGN KEY (student_id) REFERENCES students(id),
        UNIQUE(student_id, month_year)
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '1')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('dojo_name', 'My Karate Class')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('default_due_day', '5')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', '₹')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('whatsapp_template', 'Hi {name}, your karate class fee of {currency}{amount} for {month} is overdue. Please pay at your earliest convenience. Thank you!')`,
      `INSERT OR IGNORE INTO fee_plans (name, monthly_amount) VALUES ('Standard', 500)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month_year)`,
      `CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`,
    ]
  },
  {
    version: 2,
    sql: [
      // Create dojos table
      `CREATE TABLE IF NOT EXISTS dojos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1
      )`,
      // Seed a default dojo from existing settings
      `INSERT INTO dojos (name, location, phone) SELECT COALESCE(value, 'My Karate Class'), '', '' FROM settings WHERE key = 'dojo_name' LIMIT 1`,
      // Add dojo_id column to students (default 1 = the seeded dojo)
      `ALTER TABLE students ADD COLUMN dojo_id INTEGER NOT NULL DEFAULT 1 REFERENCES dojos(id)`,
      // Add dojo_id column to fee_plans
      `ALTER TABLE fee_plans ADD COLUMN dojo_id INTEGER NOT NULL DEFAULT 1 REFERENCES dojos(id)`,
      // Index for dojo filtering
      `CREATE INDEX IF NOT EXISTS idx_students_dojo ON students(dojo_id)`,
      `CREATE INDEX IF NOT EXISTS idx_fee_plans_dojo ON fee_plans(dojo_id)`,
    ]
  }
];
