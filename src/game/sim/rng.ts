/**
 * Seeded RNG so a replay of the same inputs produces the same battle. Every
 * random decision in the sim goes through this; the renderer uses Math.random
 * freely because visuals do not need to be reproducible.
 */
export class Rng {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0;
  }

  /** mulberry32 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length) % items.length];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}
