# memoru

[![NPM Version](https://img.shields.io/npm/v/memoru.svg)](https://www.npmjs.com/package/memoru)
[![Downloads Count](https://img.shields.io/npm/dm/memoru.svg)](https://www.npmjs.com/package/memoru)
[![Vulnerabilities Count](https://snyk.io/test/npm/memoru/badge.svg)](https://www.npmjs.com/package/memoru)
[![Release](https://github.com/SkeLLLa/memoru/actions/workflows/release.yml/badge.svg)](https://github.com/SkeLLLa/memoru/actions/workflows/release.yml)
[![License](https://img.shields.io/npm/l/memoru.svg)](https://github.com/SkeLLLa/memoru/blob/master/LICENSE)
[![Codecov](https://img.shields.io/codecov/c/gh/SkeLLLa/memoru.svg)](https://codecov.io/gh/SkeLLLa/memoru)

A hash-based LRU cache for Node.js that evicts entries based on memory usage or item count. Designed for high performance and low memory overhead, with TypeScript support and memory monitoring utilities.

## ToC

- [memoru](#memoru)
  - [ToC](#toc)
  - [Features](#features)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Basic LRU Usage](#basic-lru-usage)
    - [Memory Threshold Eviction](#memory-threshold-eviction)
    - [TypeScript Support](#typescript-support)
    - [Memory Monitoring Utilities](#memory-monitoring-utilities)
  - [Demo](#demo)
  - [See also](#see-also)

## Features

- Fast hash-based LRU cache with O(1) operations
- Eviction based on memory usage or item count
- Optional integration with Node.js memory stats
- TypeScript support and strict types
- Zero dependencies
- Suitable for caching in memory-constrained environments

## Installation

NPM:

```bash
npm install memoru
```

PNPM:

```bash
pnpm add memoru
```

## Usage

### Basic LRU Usage

```typescript
import { Memoru } from 'memoru';

const lru = new Memoru({ max: 100 }); // max 100 items
lru.set('foo', 'bar');
console.log(lru.get('foo')); // 'bar'
```

### Memory Threshold Eviction

Evict items automatically when process memory or V8 heap usage exceeds a threshold:

```typescript
import { Memoru, ProcessMemoryStat } from 'memoru';

const lru = new Memoru({
  max: 1000,
  memoryStats: {
    thresholds: [
      { stat: ProcessMemoryStat.RSS, threshold: 100 * 1024 * 1024 }, // 100MB
    ],
    interval: 1000, // check every second
  },
});
```

### TypeScript Support

All APIs are fully typed:

```typescript
import { Memoru } from 'memoru';

const lru = new Memoru<string, number>({ max: 10 });
lru.set('a', 1);
const value: number | undefined = lru.get('a');
```

### Memory Monitoring Utilities

You can use the memory stats monitor directly:

```typescript
import { MemoryStatsMonitor, ProcessMemoryStat } from 'memoru';

const monitor = new MemoryStatsMonitor({
  thresholds: [{ stat: ProcessMemoryStat.RSS, threshold: 200 * 1024 * 1024 }],
  interval: 5000,
});

monitor.on('threshold', (stat) => {
  console.log('Memory threshold exceeded for', stat);
});
```

## Demo

```typescript
import { Memoru } from 'memoru';

const lru = new Memoru({ max: 2 });
lru.set('a', 1);
lru.set('b', 2);
lru.set('c', 3); // 'a' is evicted
console.log(lru.get('a')); // undefined
console.log(lru.get('b')); // 2
console.log(lru.get('c')); // 3
```

## See also

- [hashlru](https://github.com/dominictarr/hashlru) - inspiration for the core algorithm
- [lru-cache](https://github.com/isaacs/node-lru-cache) - another popular LRU cache for Node.js
