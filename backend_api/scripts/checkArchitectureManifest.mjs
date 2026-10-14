// checkArchitectureManifest — CI gate for architecture-manifest.json freshness.
//
// The manifest is a generated, source-derived artifact (see
// generateArchitectureManifest.ts). This gate catches the case where someone
// adds a route / migration / model / frontend route but forgets to regenerate
// and commit data/architecture-manifest.json — real structural drift.
//
// It deliberately IGNORES two fields that are not part of that structural
// contract and can never match across machines:
//   • generatedAt     — a wall-clock timestamp, different on every run.
//   • topology.lastEdited — the topology file's mtime, which is the checkout
//                           time, not a real edit time.
// Comparing the whole file with `git diff --exit-code` made the gate
// impossible to pass (the timestamps always differ), which is why it was
// failing every CI run regardless of whether the manifest was actually stale.
//
// Run (from backend_api/, after `npm run build:architecture`):
//   node scripts/checkArchitectureManifest.mjs

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MANIFEST_REL = 'data/architecture-manifest.json';

// Fields that are environment/time-dependent and intentionally not gated.
function structural(manifest) {
    const { generatedAt, ...rest } = manifest;
    void generatedAt;
    if (rest.topology && typeof rest.topology === 'object') {
        const { lastEdited, ...topology } = rest.topology;
        void lastEdited;
        rest.topology = topology;
    }
    return rest;
}

// Defensively normalise line endings: the generator already strips CRLF from
// embedded content, but this keeps the gate robust if an older committed copy
// still carries them. In the serialised JSON, an embedded CRLF appears as the
// escaped sequence \r\n (backslash-r-backslash-n), so collapse that to \n.
function canonical(manifest) {
    return JSON.stringify(structural(manifest)).replace(/\\r\\n/g, '\\n');
}

function main() {
    const prefix = execSync('git rev-parse --show-prefix').toString().trim(); // e.g. "backend_api/"

    let committedRaw;
    try {
        committedRaw = execSync(`git show HEAD:${prefix}${MANIFEST_REL}`, {
            encoding: 'utf-8',
            maxBuffer: 32 * 1024 * 1024,
        });
    } catch {
        console.error(
            `Could not read the committed ${MANIFEST_REL} from HEAD. ` +
            `If this file is new, commit it first.`,
        );
        process.exit(1);
    }

    const generatedRaw = readFileSync(MANIFEST_REL, 'utf-8');

    let committed;
    let generated;
    try {
        committed = canonical(JSON.parse(committedRaw));
        generated = canonical(JSON.parse(generatedRaw));
    } catch (err) {
        console.error(`Failed to parse architecture manifest JSON: ${String(err)}`);
        process.exit(1);
    }

    if (committed !== generated) {
        console.error(
            'Architecture manifest is stale: the committed ' +
            `${MANIFEST_REL} does not match a fresh \`npm run build:architecture\`.\n` +
            'Run `npm run build:architecture` in backend_api/ and commit the result.\n' +
            '(The generatedAt / topology.lastEdited timestamps are ignored — this is a ' +
            'real structural difference in routes, migrations, models, frontend routes, or topology.)',
        );
        process.exit(1);
    }

    console.log('Architecture manifest is current.');
}

main();
