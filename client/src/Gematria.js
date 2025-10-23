// src/gematria.js

// Simple / Ordinal (A=1..Z=26)
const SIMPLE = Object.fromEntries(
  Array.from({ length: 26 }, (_, i) => [String.fromCharCode(97 + i), i + 1])
);

// English Gematria (A=6, B=12, ..., Z=156)
const ENGLISH = Object.fromEntries(
  Array.from({ length: 26 }, (_, i) => [String.fromCharCode(97 + i), (i + 1) * 6])
);

// Hebrew (your custom mapping)
const HEBREW = {
  a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9,
  k: 10, l: 20, m: 30, n: 40, o: 50, p: 60, q: 70, r: 80,
  s: 90, t: 100, u: 200, x: 300, y: 400, z: 500, j: 600,
  v: 700, w: 900,
};

// Helpers
export function sumByMap(str, map, filterRegex) {
  if (!str) return 0;
  let total = 0;
  for (const ch of str) {
    if (filterRegex && !filterRegex.test(ch)) continue;
    const v = map[ch.toLowerCase?.() ?? ch];
    if (typeof v === 'number') total += v;
  }
  return total;
}

export function breakdownByMap(str, map, filterRegex) {
  const items = [];
  let total = 0;
  for (const ch of str) {
    if (filterRegex && !filterRegex.test(ch)) continue;
    const key = ch.toLowerCase?.() ?? ch;
    const v = map[key];
    if (typeof v === 'number') {
      items.push([ch, v]);
      total += v;
    }
  }
  return { items, total };
}

// Basic Latin letters only for all systems
export const REGEX = {
  ENG: /[A-Za-z]/,
};

// Systems registry
export const SYSTEMS = {
  simple:  { name: 'Simple (A=1..26)', map: SIMPLE, filter: REGEX.ENG },
  english: { name: 'English (A=6..156)', map: ENGLISH, filter: REGEX.ENG },
  hebrew:  { name: 'Hebrew (A=1..Z=900)', map: HEBREW, filter: REGEX.ENG },
};
