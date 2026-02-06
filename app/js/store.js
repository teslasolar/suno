// In-browser TagStore — mirrors src/tags.ts
const t = new Map();

function read(p) { return t.get(p) ?? null; }

function write(p, v) { t.set(p, v); }

function readUDT(base) {
  const r = {};
  for (const [k, v] of t) {
    if (k.startsWith(base + '/')) setN(r, k.slice(base.length + 1), v);
  }
  return r;
}

function writeUDT(base, d) {
  flat(d, base).forEach(([p, v]) => write(p, v));
}

function keys(prefix) {
  const r = [];
  for (const k of t.keys()) {
    if (!prefix || k.startsWith(prefix)) r.push(k);
  }
  return r.sort();
}

function dump() {
  const o = {};
  for (const [k, v] of t) o[k] = v;
  return o;
}

function size() { return t.size; }

function setN(o, p, v) {
  const ps = p.split('/'); let c = o;
  for (let i = 0; i < ps.length - 1; i++) { c[ps[i]] = c[ps[i]] || {}; c = c[ps[i]]; }
  c[ps[ps.length - 1]] = v;
}

function flat(o, pre) {
  const r = [];
  for (const [k, v] of Object.entries(o)) {
    const p = `${pre}/${k}`;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date))
      r.push(...flat(v, p));
    else r.push([p, v]);
  }
  return r;
}

export const store = { read, write, readUDT, writeUDT, keys, dump, size };
