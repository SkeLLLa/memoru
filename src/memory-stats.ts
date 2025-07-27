import { EventEmitter } from 'events';
import {
  PerformanceObserver,
  type NodeGCPerformanceDetail,
} from 'node:perf_hooks';
import v8 from 'v8';

/**
 * Enum of garbage collection kinds for monitoring.
 * @public
 */
export enum GCKind {
  Minor = 'minor',
  Major = 'major',
  Incremental = 'incremental',
  WeakCallback = 'weak_callback',
}

/**
 * Enum of V8 heap space names for memory monitoring.
 * @public
 */
export enum HeapSpace {
  ReadOnly = 'read_only_space',
  New = 'new_space',
  Old = 'old_space',
  Code = 'code_space',
  Shared = 'shared_space',
  Trusted = 'trusted_space',
  NewLargeObject = 'new_large_object_space',
  LargeObject = 'large_object_space',
  CodeLargeObject = 'code_large_object_space',
  SharedLargeObject = 'shared_large_object_space',
  TrustedLargeObject = 'trusted_large_object_space',
}

/**
 * Enum of process memory stats for monitoring.
 * @public
 */
export enum ProcessMemoryStat {
  RSS = 'rss',
  HeapUsed = 'heapUsed',
}

/**
 * Union of all supported memory stat types.
 * @public
 */
export type MemoryStat = HeapSpace | ProcessMemoryStat;

/**
 * Configuration for a single monitored memory stat and its threshold.
 * @public
 */
export interface MonitoredStat {
  /**
   * The memory stat to monitor.
   */
  stat: MemoryStat;
  /**
   * The threshold value in bytes to trigger an event.
   */
  threshold: number;
}

/**
 * Options for configuring the memory stats monitor.
 * @public
 */
export interface MemoryStatsMonitorOptions {
  /**
   * Monitoring interval in milliseconds.
   * @defaultValue 1000
   */
  interval?: number;
  /**
   * List of memory stats and thresholds to monitor.
   */
  monitored: MonitoredStat[];
  /**
   * Enable garbage collection monitoring to prevent rotations during GC.
   * @defaultValue false
   */
  monitorGC?: boolean;
  /**
   * Types of garbage collection events to monitor.
   * @defaultValue All GC kinds if monitorGC is true
   */
  gcKinds?: GCKind[];
  /**
   * Time in milliseconds to wait after a GC event before allowing rotations.
   * @defaultValue 500
   */
  gcCooldown?: number;
}

/**
 * Periodically monitors V8 and process memory stats, emitting events when thresholds are reached.
 * @public
 */
export class MemoryStatsMonitor extends EventEmitter {
  private intervalId?: NodeJS.Timeout | undefined;
  private options: MemoryStatsMonitorOptions;
  private gcObserver?: PerformanceObserver | undefined;
  private isGCInProgress = false;
  private lastGCTime = 0;

  /**
   * Create a new MemoryStatsMonitor.
   * @param options - Configuration for what to monitor and thresholds
   * @public
   */
  constructor(options: MemoryStatsMonitorOptions) {
    super();
    this.options = options;
    this.start();

    if (options.monitorGC) {
      this.setupGCMonitoring();
    }
  }

  /**
   * Set up garbage collection event monitoring.
   * @internal
   */
  private setupGCMonitoring() {
    try {
      if (!this.gcObserver) {
        // Create a performance observer for GC events
        this.gcObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();

          for (const entry of entries) {
            if (entry.entryType === 'gc') {
              const detail = entry.detail as
                | NodeGCPerformanceDetail
                | undefined;
              const kind = detail?.kind ?? 0;
              const gcKind = this.mapGCKind(kind);
              const shouldMonitor =
                !this.options.gcKinds ||
                this.options.gcKinds.includes(gcKind as GCKind);

              if (shouldMonitor) {
                this.isGCInProgress = true;
                this.lastGCTime = Date.now();
                this.emit('gc:start', {
                  type: gcKind,
                  kind,
                  duration: entry.duration,
                  startTime: entry.startTime,
                });

                // After cooldown period, mark GC as completed
                const cooldownTime = this.options.gcCooldown ?? 500;
                setTimeout(() => {
                  this.isGCInProgress = false;
                  this.emit('gc:end', {
                    type: gcKind,
                    kind,
                    duration: entry.duration,
                    startTime: entry.startTime,
                  });
                }, cooldownTime);
              }
            }
          }
        });

        // Subscribe to GC notifications
        this.gcObserver.observe({ entryTypes: ['gc'] });
      }
    } catch (error) {
      console.warn('Failed to set up GC monitoring:', error);
    }
  }

  /**
   * Map Node.js GC kinds to our enum values.
   * @param kind - The GC kind number as reported by PerformanceObserver
   * @internal
   */
  private mapGCKind(kind: number): string {
    // Map numeric GC kind to our enum values
    // Based on Node.js GC kind constants:
    // 1: Scavenge (minor GC)
    // 2: Mark-Sweep-Compact (major GC)
    // 4: Incremental marking
    // 8: Weak callbacks
    switch (kind) {
      case 1:
        return GCKind.Minor;
      case 2:
        return GCKind.Major;
      case 4:
        return GCKind.Incremental;
      case 8:
        return GCKind.WeakCallback;
      default:
        return `unknown-${kind.toString()}`;
    }
  }

  /**
   * Check if garbage collection is currently in progress.
   * @returns true if GC is in progress, false otherwise
   * @public
   */
  isGCActive(): boolean {
    return this.isGCInProgress;
  }

  /**
   * Get the time elapsed since the last GC event in milliseconds.
   * @returns Number of milliseconds since last GC, or Infinity if no GC has occurred
   * @public
   */
  timeSinceLastGC(): number {
    return this.lastGCTime > 0 ? Date.now() - this.lastGCTime : Infinity;
  }

  /**
   * Start the periodic monitoring loop.
   * @internal
   */
  private start() {
    this.intervalId = setInterval(() => {
      // Skip threshold checks if GC is currently in progress
      if (this.options.monitorGC && this.isGCInProgress) {
        return;
      }

      // Optimization: fetch stats only once per interval
      const stats = v8.getHeapSpaceStatistics();
      const statsMap = new Map(stats.map((s) => [s.space_name, s]));
      const mem = process.memoryUsage();
      for (const monitor of this.options.monitored) {
        if (Object.values(HeapSpace).includes(monitor.stat as HeapSpace)) {
          const spaceStat = statsMap.get(monitor.stat.toString());
          if (spaceStat) {
            const statValue = (spaceStat as unknown as Record<string, number>)[
              'space_used_size'
            ];
            if (
              typeof statValue === 'number' &&
              statValue >= monitor.threshold
            ) {
              this.emit('threshold', {
                type: 'v8',
                stat: monitor.stat,
                value: statValue,
                threshold: monitor.threshold,
                gcActive: this.isGCInProgress,
                timeSinceLastGC: this.timeSinceLastGC(),
              });
            }
          }
        } else if (
          monitor.stat === ProcessMemoryStat.RSS ||
          monitor.stat === ProcessMemoryStat.HeapUsed
        ) {
          const value =
            monitor.stat === ProcessMemoryStat.RSS ? mem.rss : mem.heapUsed;
          if (typeof value === 'number' && value >= monitor.threshold) {
            this.emit('threshold', {
              type: 'process',
              stat: monitor.stat,
              value,
              threshold: monitor.threshold,
              gcActive: this.isGCInProgress,
              timeSinceLastGC: this.timeSinceLastGC(),
            });
          }
        }
      }
    }, this.options.interval ?? 1000).unref();
  }

  /**
   * Stop the monitoring loop.
   * @public
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (this.gcObserver) {
      this.gcObserver.disconnect();
      this.gcObserver = undefined;
    }
  }

  /**
   * Check if the monitor is currently active.
   * @returns true if monitoring is active, false otherwise
   * @public
   */
  isMonitoring(): boolean {
    return this.intervalId !== undefined;
  }
}
