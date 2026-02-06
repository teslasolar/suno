import { EventEmitter } from 'events';

type Val = string | number | boolean | Date | null | Val[] | { [k: string]: Val };

class TagStore extends EventEmitter {
  private t = new Map<string, Val>();

  read(p: string): Val {
    return this.t.get(p) ?? null;
  }

  write(p: string, v: Val) {
    const old = this.t.get(p);
    this.t.set(p, v);
    if (old !== v) this.emit('change', { p, old, v });
  }

  dump(): Record<string, Val> {
    const o: Record<string, Val> = {};
    for (const [k, v] of this.t) o[k] = v;
    return o;
  }

  clear() {
    this.t.clear();
  }

  size(): number {
    return this.t.size;
  }

  keys(prefix?: string): string[] {
    const r: string[] = [];
    for (const k of this.t.keys()) {
      if (!prefix || k.startsWith(prefix)) r.push(k);
    }
    return r.sort();
  }

  readUDT<T>(base: string): T {
    const r: any = {};
    for (const [k, v] of this.t) {
      if (k.startsWith(base + '/')) {
        this.setN(r, k.slice(base.length + 1), v);
      }
    }
    return r;
  }

  writeUDT(base: string, d: object) {
    this.flat(d, base).forEach(([p, v]) => this.write(p, v));
  }

  private setN(o: any, p: string, v: Val) {
    const ps = p.split('/');
    let c = o;
    for (let i = 0; i < ps.length - 1; i++) {
      c[ps[i]] = c[ps[i]] || {};
      c = c[ps[i]];
    }
    c[ps[ps.length - 1]] = v;
  }

  private flat(o: any, pre: string): [string, Val][] {
    const r: [string, Val][] = [];
    for (const [k, v] of Object.entries(o)) {
      const p = `${pre}/${k}`;
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        r.push(...this.flat(v, p));
      } else {
        r.push([p, v as Val]);
      }
    }
    return r;
  }
}

export const tags = new TagStore();
