import { MemoryStatsMonitor, MemoryStatsMonitorOptions } from './memory-stats';

/**
 * Options for configuring the Memoru cache.
 * @public
 */
export interface MemoruOptions {
  /**
   * Maximum number of items in the cache. If not set, the cache is only rotated on memory threshold events.
   * @defaultValue undefined
   */
  max?: number;
  /**
   * Optional memory stats monitor configuration. If set, the cache will rotate when a memory threshold is reached.
   * @defaultValue undefined
   */
  memoryStats?: MemoryStatsMonitorOptions;
}

/**
 * Memoru is a high-performance LRU cache using a two-map hashlru algorithm.
 * Supports any key type and can be rotated by size or memory threshold.
 * @public
 */
export class Memoru<K, V> {
  private max: number | undefined;
  private size: number;
  private cache: Map<K, V>;
  private _cache: Map<K, V>;
  private memoryMonitor?: MemoryStatsMonitor;

  /**
   * Create a new Memoru instance.
   * @param options - Configuration options for the cache
   * @public
   */
  constructor(options: MemoruOptions) {
    if (
      options.max !== undefined &&
      (typeof options.max !== 'number' || options.max <= 0)
    ) {
      throw new Error(
        'Memoru max value, if provided, must be a number greater than 0',
      );
    }
    this.max = options.max;
    this.size = 0;
    this.cache = new Map<K, V>();
    this._cache = new Map<K, V>();

    if (options.memoryStats) {
      this.memoryMonitor = new MemoryStatsMonitor(options.memoryStats);
      this.memoryMonitor.on('threshold', () => {
        this.rotate();
      });
    }
  }

  /**
   * Rotate the cache, moving current cache to shadow cache and clearing the main cache.
   * Called internally on size or memory threshold.
   * @internal
   */
  private rotate() {
    this.size = 0;
    this._cache = this.cache;
    this.cache = new Map<K, V>();
  }

  /**
   * Internal update method for inserting a new item and handling rotation.
   * @param key - The key to insert
   * @param value - The value to insert
   * @internal
   */
  private update(key: K, value: V) {
    this.cache.set(key, value);
    this.size++;
    if (this.max !== undefined && this.size >= this.max) {
      this.rotate();
    }
  }

  /**
   * Check if the cache contains a key.
   * @param key - The key to check
   * @public
   */
  has(key: K): boolean {
    return this.cache.has(key) || this._cache.has(key);
  }

  /**
   * Remove a key from the cache and shadow cache.
   * @param key - The key to remove
   * @public
   */
  remove(key: K): void {
    this.cache.delete(key);
    this._cache.delete(key);
  }

  /**
   * Get a value from the cache. If found in the shadow cache, it is promoted to the main cache.
   * @param key - The key to retrieve
   * @public
   */
  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    if (this._cache.has(key)) {
      const v = this._cache.get(key);
      if (v !== undefined) {
        this.update(key, v);
        return v;
      }
    }
    return undefined;
  }

  /**
   * Set a value in the cache.
   * @param key - The key to set
   * @param value - The value to set
   * @public
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.set(key, value);
    } else {
      this.update(key, value);
    }
  }

  /**
   * Clear the cache and shadow cache.
   * @public
   */
  clear(): void {
    this.cache = new Map<K, V>();
    this._cache = new Map<K, V>();
    this.size = 0;
  }
}
