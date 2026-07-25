import { Injectable, signal } from '@angular/core';

export interface GlobalErrorNotice {
  id: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class GlobalErrorService {
  private nextId = 1;

  readonly notice = signal<GlobalErrorNotice | null>(null);

  dismiss(): void {
    this.notice.set(null);
  }

  report(message: string): void {
    this.notice.set({ id: this.nextId, message });
    this.nextId += 1;
  }
}
