// parse-grapplemap.js — Extract positions and transitions from GrappleMap.txt
// into structured JSON for analysis.
//
// GrappleMap format:
//   - Positions: name (multiline, \n-separated), then "tags: ...", then encoded keyframe data
//   - Transitions: same but with "from: ..." and "to: ..." lines linking positions
//
// Run: node parse-grapplemap.js

const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync(path.join(__dirname, 'grapplemap-source', 'GrappleMap.txt'), 'utf-8');

const lines = raw.split('\n');

const positions = [];
const transitions = [];

let i = 0;
while (i < lines.length) {
  const line = lines[i].trim();

  // Skip empty lines and encoded keyframe data (base64-like strings)
  if (!line || /^[A-Za-z0-9+/=]{30,}$/.test(line)) {
    i++;
    continue;
  }

  // A tag line indicates a position or transition entry
  if (line.startsWith('tags:')) {
    // Look backwards to find the name (lines above that aren't tags/keyframes)
    const tags = line.replace('tags:', '').trim().split(/\s+/);

    // Collect name from preceding non-empty, non-keyframe lines
    let nameLines = [];
    let j = i - 1;
    while (j >= 0) {
      const prev = lines[j].trim();
      if (!prev || prev.startsWith('tags:') || /^[A-Za-z0-9+/=]{30,}$/.test(prev) ||
          prev.startsWith('properties:') || prev.startsWith('ref:')) {
        break;
      }
      nameLines.unshift(prev);
      j--;
    }

    const name = nameLines.join(' ').replace(/\\n/g, ' ').trim();

    if (name) {
      positions.push({ name, tags });
    }

    i++;
    continue;
  }

  i++;
}

// Deduplicate by name
const seen = new Set();
const uniquePositions = positions.filter(p => {
  if (seen.has(p.name)) return false;
  seen.add(p.name);
  return true;
});

// Collect all unique tags
const allTags = new Set();
uniquePositions.forEach(p => p.tags.forEach(t => allTags.add(t)));

// Categorize tags into types
const positionTags = [...allTags].filter(t =>
  t.includes('guard') || t.includes('mount') || t.includes('control') ||
  t.includes('turtle') || t.includes('back') || t.includes('standing') ||
  t.includes('half') || t.includes('side') || t.includes('north') ||
  t.includes('butterfly') || t.includes('x_guard') || t.includes('z_guard') ||
  t.includes('50_50') || t.includes('quarter') || t.includes('knee_on') ||
  t.includes('deep_half') || t.includes('lockdown')
);

const techniqueTags = [...allTags].filter(t =>
  t.includes('sweep') || t.includes('pass') || t.includes('takedown') ||
  t.includes('choke') || t.includes('lock') || t.includes('bar') ||
  t.includes('triangle') || t.includes('armbar') || t.includes('guillotine') ||
  t.includes('kimura') || t.includes('omoplata') || t.includes('darce') ||
  t.includes('heel_hook') || t.includes('toehold') || t.includes('knee_bar') ||
  t.includes('drag') || t.includes('trip') || t.includes('throw')
);

const bodyPositionTags = [...allTags].filter(t =>
  t.startsWith('top_') || t.startsWith('bottom_')
);

// Summary
const summary = {
  totalEntries: positions.length,
  uniquePositions: uniquePositions.length,
  uniqueTags: allTags.size,
  tagCategories: {
    positions: positionTags.sort(),
    techniques: techniqueTags.sort(),
    bodyPositions: bodyPositionTags.sort(),
  },
  samplePositions: uniquePositions.slice(0, 20).map(p => ({
    name: p.name,
    tags: p.tags,
  })),
};

// Write outputs
fs.writeFileSync(
  path.join(__dirname, 'grapplemap-positions.json'),
  JSON.stringify(uniquePositions, null, 2),
);

fs.writeFileSync(
  path.join(__dirname, 'grapplemap-summary.json'),
  JSON.stringify(summary, null, 2),
);

console.log(`Parsed ${uniquePositions.length} unique positions from ${positions.length} total entries`);
console.log(`${allTags.size} unique tags`);
console.log(`Written to grapplemap-positions.json and grapplemap-summary.json`);
