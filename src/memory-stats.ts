import { EventEmitter } from 'events';
import v8 from 'v8';

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
}

/**
 * Periodically monitors V8 and process memory stats, emitting events when thresholds are reached.
 * @public
 */
export class MemoryStatsMonitor extends EventEmitter {
  private intervalId?: NodeJS.Timeout | undefined;
  private options: MemoryStatsMonitorOptions;

  /**
   * Create a new MemoryStatsMonitor.
   * @param options - Configuration for what to monitor and thresholds
   * @public
   */
  constructor(options: MemoryStatsMonitorOptions) {
    super();
    this.options = options;
    this.start();
  }

  /**
   * Start the periodic monitoring loop.
   * @internal
   */
  private start() {
    this.intervalId = setInterval(() => {
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
