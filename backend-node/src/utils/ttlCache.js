/** Small in-memory TTL cache (per process) in front of MySQL / providers. */
export class TtlCache {
  constructor(maxEntries = 500) {
    this.map = new Map();
    this.maxEntries = maxEntries;
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value, ttlSeconds) {
    if (this.map.size >= this.maxEntries) this.map.delete(this.map.keys().next().value);
    this.map.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
    return value;
  }

  /** Return cached value or compute it once (concurrent callers share the promise). */
  async wrap(key, ttlSeconds, compute) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const promise = compute();
    this.set(key, promise, ttlSeconds);
    try {
      const value = await promise;
      this.set(key, value, ttlSeconds);
      return value;
    } catch (err) {
      this.map.delete(key);
      throw err;
    }
  }

  clear() {
    this.map.clear();
  }
}
