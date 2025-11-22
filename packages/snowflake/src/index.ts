/**
 * Snowflake ID generator
 * 64-bit sortable ID: timestamp (41 bits) + workerId (10 bits) + sequence (12 bits)
 */

const EPOCH = 1704067200000n; // 2024-01-01 00:00:00 UTC
const WORKER_ID_BITS = 10n;
const SEQUENCE_BITS = 12n;

const MAX_WORKER_ID = (1n << WORKER_ID_BITS) - 1n;
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;

const WORKER_ID_SHIFT = SEQUENCE_BITS;
const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;

export interface SnowflakeConfig {
  workerId?: number;
  epoch?: bigint;
}

export class Snowflake {
  private workerId: bigint;
  private sequence: bigint = 0n;
  private lastTimestamp: bigint = 0n;
  private epoch: bigint;

  constructor(config: SnowflakeConfig = {}) {
    const workerId = config.workerId ?? this.getDefaultWorkerId();
    if (workerId < 0 || workerId > Number(MAX_WORKER_ID)) {
      throw new Error(`Worker ID must be between 0 and ${MAX_WORKER_ID}`);
    }
    this.workerId = BigInt(workerId);
    this.epoch = config.epoch ?? EPOCH;
  }

  private getDefaultWorkerId(): number {
    // Use process ID or random number as default worker ID
    if (typeof process !== "undefined" && process.pid) {
      return process.pid % Number(MAX_WORKER_ID);
    }
    return Math.floor(Math.random() * Number(MAX_WORKER_ID));
  }

  private getTimestamp(): bigint {
    return BigInt(Date.now());
  }

  private waitNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = this.getTimestamp();
    while (timestamp <= lastTimestamp) {
      timestamp = this.getTimestamp();
    }
    return timestamp;
  }

  generate(): string {
    let timestamp = this.getTimestamp();

    if (timestamp < this.lastTimestamp) {
      throw new Error(
        `Clock moved backwards. Refusing to generate id for ${this.lastTimestamp - timestamp} milliseconds`
      );
    }

    if (this.lastTimestamp === timestamp) {
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
      if (this.sequence === 0n) {
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    const id =
      ((timestamp - this.epoch) << TIMESTAMP_SHIFT) |
      (this.workerId << WORKER_ID_SHIFT) |
      this.sequence;

    return id.toString();
  }
}

// Singleton instance
let defaultSnowflake: Snowflake | null = null;

export function getSnowflake(config?: SnowflakeConfig): Snowflake {
  if (!defaultSnowflake) {
    defaultSnowflake = new Snowflake(config);
  }
  return defaultSnowflake;
}

export function generateId(config?: SnowflakeConfig): string {
  return getSnowflake(config).generate();
}

