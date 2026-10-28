// Base de pruebas: SQLite de Node con la misma forma que env.DB del sitio.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Val = string | number | null | bigint | Uint8Array;

function limpiar(v: unknown): Val {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v as Val;
}

class Stmt {
  constructor(
    private db: DatabaseSync,
    private sql: string,
    private params: Val[] = [],
  ) {}
  bind(...p: unknown[]) {
    return new Stmt(this.db, this.sql, p.map(limpiar));
  }
  async first<T>(col?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).all(...this.params)[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return (col ? row[col] : { ...row }) as T;
  }
  async all<T>() {
    return this.allSync<T>();
  }
  allSync<T>() {
    const rows = this.db.prepare(this.sql).all(...this.params).map((r) => ({ ...r })) as T[];
    return { results: rows, success: true, meta: {} };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { success: true, results: [], meta: { changes: Number(r.changes) } };
  }
}

export function crearD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../schema.sql'), 'utf8'));
  const d1 = {
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(stmts: Stmt[]) {
      db.exec('BEGIN');
      try {
        const out = stmts.map((s) => s.allSync());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    exec: async (sql: string) => db.exec(sql),
  };
  return d1 as unknown as D1Database;
}

export function crearBucket() {
  const store = new Map<string, { bytes: Uint8Array; type?: string }>();
  const bucket = {
    store,
    async put(key: string, bytes: Uint8Array, opts?: { httpMetadata?: { contentType?: string } }) {
      store.set(key, { bytes, type: opts?.httpMetadata?.contentType });
    },
    async get(key: string) {
      const o = store.get(key);
      return o ? { body: o.bytes } : null;
    },
    async head(key: string) {
      return store.has(key) ? {} : null;
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
  return bucket;
}
