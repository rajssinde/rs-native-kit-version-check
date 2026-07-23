import type { IClock } from '../../domain/ports/IClock';

export class MockClock implements IClock {
  private currentTime: number;

  constructor(initial: number = 0) {
    this.currentTime = initial;
  }

  now(): number {
    return this.currentTime;
  }

  set(time: number): void {
    this.currentTime = time;
  }

  advance(ms: number): void {
    this.currentTime += ms;
  }
}
