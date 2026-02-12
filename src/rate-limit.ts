interface RateLimitBucket {
  timestamps: number[];
}

export class RateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private globalBucket: RateLimitBucket = { timestamps: [] };

  private globalMaxRequests: number;
  private globalWindowMs: number;

  private toolLimits = new Map<string, { maxRequests: number; windowMs: number }>();

  constructor(
    globalMaxRequests = 100,
    globalWindowMs = 60_000
  ) {
    this.globalMaxRequests = globalMaxRequests;
    this.globalWindowMs = globalWindowMs;

    // Stricter limits for destructive operations
    const destructiveLimits = { maxRequests: 5, windowMs: 60_000 };
    const mutateLimits = { maxRequests: 10, windowMs: 60_000 };

    for (const tool of ["dns_delete_zone", "dns_delete_record", "dns_flush_cache"]) {
      this.toolLimits.set(tool, destructiveLimits);
    }
    for (const tool of [
      "dns_create_zone", "dns_add_record", "dns_update_record",
      "dns_block_domain", "dns_allow_domain",
    ]) {
      this.toolLimits.set(tool, mutateLimits);
    }
  }

  check(toolName: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();

    // Check global limit
    this.pruneTimestamps(this.globalBucket, now, this.globalWindowMs);
    if (this.globalBucket.timestamps.length >= this.globalMaxRequests) {
      const oldest = this.globalBucket.timestamps[0];
      return {
        allowed: false,
        retryAfterMs: oldest + this.globalWindowMs - now,
      };
    }

    // Check per-tool limit
    const limit = this.toolLimits.get(toolName);
    if (limit) {
      if (!this.buckets.has(toolName)) {
        this.buckets.set(toolName, { timestamps: [] });
      }
      const bucket = this.buckets.get(toolName)!;
      this.pruneTimestamps(bucket, now, limit.windowMs);

      if (bucket.timestamps.length >= limit.maxRequests) {
        const oldest = bucket.timestamps[0];
        return {
          allowed: false,
          retryAfterMs: oldest + limit.windowMs - now,
        };
      }

      bucket.timestamps.push(now);
    }

    this.globalBucket.timestamps.push(now);
    return { allowed: true };
  }

  private pruneTimestamps(
    bucket: RateLimitBucket,
    now: number,
    windowMs: number
  ): void {
    const cutoff = now - windowMs;
    while (bucket.timestamps.length > 0 && bucket.timestamps[0] < cutoff) {
      bucket.timestamps.shift();
    }
  }
}
