// src/lib/circuit-breaker.ts
// Simple in-memory circuit breaker pattern.
//
// States: CLOSED (normal) → OPEN (failures exceeded threshold) → HALF_OPEN (testing recovery)
//
// Usage:
//   const cb = new CircuitBreaker("envio", { threshold: 3, cooldownMs: 30_000 });
//   const result = await cb.execute(() => fetchSomeAPI());
//
// No external dependencies — pure TypeScript.

import { logger } from "./logger";

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit. */
  threshold?: number;
  /** Time in ms to wait before transitioning from OPEN → HALF_OPEN. */
  cooldownMs?: number;
}

interface CircuitMetrics {
  failures: number;
  successes: number;
  lastFailureAt: number | null;
  lastStateChangeAt: number;
  state: CircuitState;
}

export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private metrics: CircuitMetrics;

  constructor(public readonly name: string, config: CircuitBreakerConfig = {}) {
    this.config = {
      threshold: config.threshold ?? 3,
      cooldownMs: config.cooldownMs ?? 30_000,
    };
    this.metrics = {
      failures: 0,
      successes: 0,
      lastFailureAt: null,
      lastStateChangeAt: Date.now(),
      state: "closed",
    };
  }

  get state(): CircuitState {
    // Auto-transition: OPEN → HALF_OPEN after cooldown
    if (
      this.metrics.state === "open" &&
      this.metrics.lastFailureAt &&
      Date.now() - this.metrics.lastFailureAt >= this.config.cooldownMs
    ) {
      this.transitionTo("half-open");
    }
    return this.metrics.state;
  }

  get isOpen(): boolean {
    return this.state === "open";
  }

  get metricsSnapshot(): CircuitMetrics {
    return { ...this.metrics };
  }

  /**
   * Execute a function through the circuit breaker.
   * - CLOSED: executes normally, tracks failures
   - OPEN: throws CircuitOpenError immediately
   - HALF_OPEN: allows one probe request through
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.state;

    if (state === "open") {
      logger.warn(`Circuit breaker OPEN: ${this.name} — rejecting request`);
      throw new CircuitOpenError(this.name, this.config.cooldownMs);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.metrics.successes++;
    this.metrics.failures = 0; // Reset on success

    if (this.metrics.state === "half-open") {
      this.transitionTo("closed");
      logger.info(`Circuit breaker recovered: ${this.name}`);
    }
  }

  private onFailure(): void {
    this.metrics.failures++;
    this.metrics.lastFailureAt = Date.now();

    if (this.metrics.state === "half-open") {
      // Probe failed — go back to OPEN
      this.transitionTo("open");
      logger.warn(`Circuit breaker probe failed: ${this.name} — reopening`);
    } else if (this.metrics.failures >= this.config.threshold) {
      this.transitionTo("open");
      logger.error(
        `Circuit breaker OPEN: ${this.name} (${this.metrics.failures} consecutive failures)`
      );
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.metrics.state === newState) return;
    logger.info(`Circuit breaker: ${this.name} ${this.metrics.state} → ${newState}`);
    this.metrics.state = newState;
    this.metrics.lastStateChangeAt = Date.now();
  }

  /** Manually reset the circuit (e.g., after admin intervention). */
  reset(): void {
    this.metrics = {
      failures: 0,
      successes: 0,
      lastFailureAt: null,
      lastStateChangeAt: Date.now(),
      state: "closed",
    };
    logger.info(`Circuit breaker manually reset: ${this.name}`);
  }
}

export class CircuitOpenError extends Error {
  constructor(circuitName: string, cooldownMs: number) {
    super(`Circuit breaker "${circuitName}" is open. Retry after ${Math.round(cooldownMs / 1000)}s`);
    this.name = "CircuitOpenError";
  }
}

// ─── Shared instances ──────────────────────────────────────────────

export const circuitBreakers = {
  envio: new CircuitBreaker("envio-hypersync", { threshold: 3, cooldownMs: 30_000 }),
  etherscan: new CircuitBreaker("etherscan-fallback", { threshold: 5, cooldownMs: 60_000 }),
  defillama: new CircuitBreaker("defillama", { threshold: 3, cooldownMs: 30_000 }),
  coingecko: new CircuitBreaker("coingecko", { threshold: 3, cooldownMs: 30_000 }),
  eigenphi: new CircuitBreaker("eigenphi", { threshold: 3, cooldownMs: 60_000 }),
};
