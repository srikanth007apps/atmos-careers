/**
 * A small in-memory stand-in for the Firebase Admin Realtime Database API surface used by the repos.
 * It supports get/set/update (multi-path)/remove/push/transaction and orderByChild queries.
 */
type Json = Record<string, unknown>;

export const INC = Symbol("increment");
export const increment = (n: number) => ({ [INC]: n });

let counter = 0;
export function pushId() {
  counter += 1;
  return `-id${String(counter).padStart(6, "0")}`;
}

function split(path: string) {
  return path.split("/").filter(Boolean);
}

export class FakeDb {
  data: Json = {};
  /** Simulate a project whose database rules (indexes) were never published. */
  missingIndexes = false;

  read(path: string): unknown {
    let cur: unknown = this.data;
    for (const p of split(path)) {
      if (cur == null || typeof cur !== "object") return null;
      cur = (cur as Json)[p];
    }
    return cur === undefined ? null : structuredClone(cur);
  }

  write(path: string, value: unknown) {
    const parts = split(path);
    if (parts.length === 0) {
      this.data = (value as Json) ?? {};
      return;
    }
    let cur = this.data;
    for (const p of parts.slice(0, -1)) {
      if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
      cur = cur[p] as Json;
    }
    const last = parts[parts.length - 1];
    if (value && typeof value === "object" && INC in (value as object)) {
      cur[last] = Number(cur[last] ?? 0) + (value as { [INC]: number })[INC];
      return;
    }
    if (value === null || value === undefined) delete cur[last];
    else cur[last] = structuredClone(value);
  }

  ref(path = "") {
    return new FakeRef(this, path);
  }
}

class Snapshot {
  constructor(public key: string | null, private value: unknown) {}
  exists() {
    return this.value !== null && this.value !== undefined;
  }
  val() {
    return this.value ?? null;
  }
  forEach(cb: (child: Snapshot) => void) {
    if (this.value && typeof this.value === "object") {
      for (const [k, v] of Object.entries(this.value as Json)) cb(new Snapshot(k, v));
    }
    return false;
  }
}

class FakeQuery {
  private equal?: unknown;
  private start?: number;
  private end?: number;
  private last?: number;
  private first?: number;
  constructor(protected db: FakeDb, protected path: string, private orderField?: string) {}
  equalTo(v: unknown) {
    this.equal = v;
    return this;
  }
  startAt(v: number) {
    this.start = v;
    return this;
  }
  endAt(v: number) {
    this.end = v;
    return this;
  }
  limitToLast(n: number) {
    this.last = n;
    return this;
  }
  limitToFirst(n: number) {
    this.first = n;
    return this;
  }
  async get() {
    if (this.db.missingIndexes && this.orderField) {
      throw new Error(`Index not defined, add ".indexOn": "${this.orderField}", for path "/${this.path}", to the rules`);
    }
    const raw = (this.db.read(this.path) ?? {}) as Json;
    const field = (v: unknown) => (this.orderField ? (v as Json)?.[this.orderField] : v);
    let entries = Object.entries(raw);
    if (this.orderField) entries.sort((a, b) => (field(a[1]) as number) > (field(b[1]) as number) ? 1 : -1);
    if (this.equal !== undefined) entries = entries.filter(([, v]) => field(v) === this.equal);
    if (this.start !== undefined) entries = entries.filter(([, v]) => (field(v) as number) >= this.start!);
    if (this.end !== undefined) entries = entries.filter(([, v]) => (field(v) as number) <= this.end!);
    if (this.first !== undefined) entries = entries.slice(0, this.first);
    if (this.last !== undefined) entries = entries.slice(-this.last);
    return new Snapshot(null, entries.length ? Object.fromEntries(entries) : null);
  }
}

class FakeRef extends FakeQuery {
  constructor(db: FakeDb, path: string) {
    super(db, path);
  }
  get key() {
    const parts = split(this.path);
    return parts[parts.length - 1] ?? null;
  }
  child(p: string) {
    return new FakeRef(this.db, `${this.path}/${p}`);
  }
  orderByChild(child: string) {
    return new FakeQuery(this.db, this.path, child);
  }
  async get() {
    return new Snapshot(this.key, this.db.read(this.path));
  }
  async set(v: unknown) {
    this.db.write(this.path, v);
  }
  async update(values: Json) {
    for (const [k, v] of Object.entries(values)) this.db.write(`${this.path}/${k}`, v);
  }
  async remove() {
    this.db.write(this.path, null);
  }
  push() {
    return new FakeRef(this.db, `${this.path}/${pushId()}`);
  }
  async transaction(fn: (cur: unknown) => unknown) {
    const next = fn(this.db.read(this.path));
    if (next === undefined) return { committed: false, snapshot: new Snapshot(this.key, this.db.read(this.path)) };
    this.db.write(this.path, next);
    return { committed: true, snapshot: new Snapshot(this.key, next) };
  }
}

export const fake = { db: new FakeDb() };

/** Module factory for vi.mock("@/lib/server/firebase-admin"). */
export function firebaseAdminMock() {
  return {
    adminDb: () => fake.db,
    newId: () => pushId(),
    increment,
    withIndexFallback: async <T>(a: () => Promise<T>, b: () => Promise<T>) => {
      try {
        return await a();
      } catch (err) {
        if (!/Index not defined/.test(String((err as Error).message))) throw err;
        return b();
      }
    },
    mapToArray: <T>(value: Record<string, unknown> | null | undefined): T[] =>
      value ? Object.entries(value).map(([id, v]) => ({ ...(v as object), id }) as T) : [],
  };
}
