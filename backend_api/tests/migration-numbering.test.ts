// Guards the migration filename contract. Pure filesystem checks — no DB, no
// Express app — so this suite always runs, unlike regressions.test.ts.
//
// Why it exists: 024, 025, 027 and 028 each existed twice at one point. Apply
// order then came from how the two names happened to sort alphabetically
// rather than from author intent, and nothing failed to point it out.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RENAMED_MIGRATIONS } from '../src/config/migrationRenames.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

describe('migration numbering', () => {
  it('finds migration files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('prefixes every migration with exactly three digits and an underscore', () => {
    const malformed = files.filter(f => !/^\d{3}_/.test(f));
    expect(malformed).toEqual([]);
  });

  it('assigns each number to exactly one file', () => {
    const byNumber = new Map<string, string[]>();
    for (const file of files) {
      const number = file.slice(0, 3);
      byNumber.set(number, [...(byNumber.get(number) ?? []), file]);
    }

    const duplicates = [...byNumber.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([number, owners]) => `${number}: ${owners.join(', ')}`);

    // A duplicate number means apply order is decided by alphabetical accident.
    expect(duplicates).toEqual([]);
  });
});

describe('RENAMED_MIGRATIONS', () => {
  it('points at a file that exists on disk', () => {
    const missing = RENAMED_MIGRATIONS.map(([, newName]) => newName).filter(n => !files.includes(n));
    expect(missing).toEqual([]);
  });

  it('never points at a name still present on disk under the old number', () => {
    // An old name back on disk would mean the file is applied twice: once via
    // the backfill under its new name, once as a genuinely new migration.
    const resurrected = RENAMED_MIGRATIONS.map(([oldName]) => oldName).filter(n => files.includes(n));
    expect(resurrected).toEqual([]);
  });

  it('maps each old name once and each new name once', () => {
    const oldNames = RENAMED_MIGRATIONS.map(([oldName]) => oldName);
    const newNames = RENAMED_MIGRATIONS.map(([, newName]) => newName);
    expect(new Set(oldNames).size).toBe(oldNames.length);
    expect(new Set(newNames).size).toBe(newNames.length);
  });

  it('keeps the descriptive part of the filename across a renumber', () => {
    // The number moves; the subject must not. A mismatch here means the map
    // would mark an unrelated migration as already applied.
    for (const [oldName, newName] of RENAMED_MIGRATIONS) {
      expect(newName.slice(3)).toBe(oldName.slice(3));
    }
  });
});
