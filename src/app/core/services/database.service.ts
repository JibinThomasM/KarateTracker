import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { MIGRATIONS, SCHEMA_VERSION } from '../db/migrations';

const IDB_NAME = 'karate-tracker-db';
const IDB_STORE = 'sqlitedb';
const IDB_KEY = 'main';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private db!: Database;
  private SQL!: SqlJsStatic;
  private idb!: IDBPDatabase;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    this.SQL = await initSqlJs({
      locateFile: (file: string) => `assets/sql-wasm.wasm`
    });

    this.idb = await openDB(IDB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      }
    });

    const savedDb = await this.idb.get(IDB_STORE, IDB_KEY);
    if (savedDb) {
      this.db = new this.SQL.Database(new Uint8Array(savedDb));
    } else {
      this.db = new this.SQL.Database();
    }

    this.runMigrations();
    await this.save();
    this.initialized = true;
  }

  private runMigrations(): void {
    const currentVersion = this.getSchemaVersion();
    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        for (const sql of migration.sql) {
          this.db.run(sql);
        }
        this.db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '${migration.version}')`);
      }
    }
  }

  private getSchemaVersion(): number {
    try {
      const result = this.db.exec("SELECT value FROM settings WHERE key = 'schema_version'");
      if (result.length > 0 && result[0].values.length > 0) {
        return parseInt(result[0].values[0][0] as string, 10);
      }
    } catch {
      // settings table doesn't exist yet
    }
    return 0;
  }

  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
    const stmt = this.db.prepare(sql);
    if (params) {
      stmt.bind(params);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  run(sql: string, params?: unknown[]): void {
    this.db.run(sql, params as any);
    this.save();
  }

  exec(sql: string): void {
    this.db.exec(sql);
    this.save();
  }

  async save(): Promise<void> {
    const data = this.db.export();
    await this.idb.put(IDB_STORE, data, IDB_KEY);
  }

  exportDatabase(): Uint8Array {
    return this.db.export();
  }

  async importDatabase(data: Uint8Array): Promise<void> {
    this.db.close();
    this.db = new this.SQL.Database(data);
    await this.save();
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
