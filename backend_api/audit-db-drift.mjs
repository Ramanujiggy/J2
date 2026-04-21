// Read-only audit: find columns whose DEFAULT literal is NOT in the allowed set
// defined by the column's CHECK constraint. This is the same class of bug that
// broke user registration (belt_rank defaulted to 'White' while the CHECK only
// allowed lowercase values). See migration 011 for the fix.

import { config } from 'dotenv';
import pg from 'pg';

config();
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  // Pull every column default + every check constraint in the public schema,
  // then cross-reference in memory.
  const defaultsRes = await pool.query(`
    SELECT table_name, column_name, column_default, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_default IS NOT NULL
    ORDER BY table_name, column_name
  `);

  const checksRes = await pool.query(`
    SELECT tc.table_name, cc.check_clause, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'CHECK'
    ORDER BY tc.table_name
  `);

  console.log('=== Columns with DEFAULT values ===\n');
  for (const r of defaultsRes.rows) {
    console.log(`  ${r.table_name}.${r.column_name}: DEFAULT ${r.column_default} (${r.data_type}, nullable=${r.is_nullable})`);
  }

  console.log('\n=== CHECK constraints ===\n');
  for (const r of checksRes.rows) {
    console.log(`  [${r.table_name}] ${r.constraint_name}: ${r.check_clause}`);
  }

  console.log('\n=== Cross-reference — potential drift ===\n');
  let drift = 0;
  for (const d of defaultsRes.rows) {
    const checks = checksRes.rows.filter(c => c.table_name === d.table_name);
    for (const c of checks) {
      const clause = c.check_clause;
      // Heuristic: clause mentions the column AND has a literal IN (...) list
      // Cover three patterns: `col IN (...)`, `col = ANY (ARRAY[...])`, and literal-only.
      const looksLikeAllowlist = clause.includes(d.column_name) && (
        /IN\s*\(/i.test(clause) || /ANY\s*\(\s*ARRAY\s*\[/i.test(clause)
      );
      if (looksLikeAllowlist) {
        // Extract literals — match either IN (...) or ARRAY[...]
        const inMatch = clause.match(/IN\s*\(([^)]+)\)/i);
        const arrMatch = clause.match(/ARRAY\s*\[([^\]]+)\]/i);
        const listBody = inMatch?.[1] ?? arrMatch?.[1];
        if (!listBody) continue;
        const allowed = listBody
          .split(',')
          .map(s => s.trim()
            .replace(/::\w+(\s*\[\])?/g, '')      // strip ::text, ::character varying
            .replace(/^['"]|['"]$/g, '')          // strip quotes
            .toLowerCase());

        // Extract default literal
        const defLit = (d.column_default || '').replace(/::\w+(\[\])?$/, '').replace(/^'|'$/g, '').toLowerCase();
        if (defLit === 'null' || defLit === '') continue;
        // Skip non-literal defaults like gen_random_uuid(), now(), etc.
        if (/\(.*\)/.test(d.column_default)) continue;

        if (!allowed.includes(defLit)) {
          console.log(`  ⚠ DRIFT: ${d.table_name}.${d.column_name}`);
          console.log(`    DEFAULT: ${d.column_default}`);
          console.log(`    CHECK allows: ${allowed.join(', ')}`);
          console.log(`    Constraint: ${c.constraint_name}`);
          console.log('');
          drift++;
        }
      }
    }
  }

  if (drift === 0) {
    console.log('  No default/CHECK drift detected. Clean.\n');
  } else {
    console.log(`\n  ⚠ ${drift} drift issue(s) found. Write migrations to fix.\n`);
  }
} catch (e) {
  console.error('Audit failed:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
