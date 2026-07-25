import { TestBed } from '@angular/core/testing';

import { GlobalErrorService } from './global-error.service';

describe('GlobalErrorService', () => {
  it('publishes dismissible notices with stable identities', () => {
    const service = TestBed.inject(GlobalErrorService);

    service.report('First failure');
    const first = service.notice();
    service.report('Second failure');
    const second = service.notice();

    expect(second?.id).toBeGreaterThan(first?.id ?? 0);
    expect(second?.message).toBe('Second failure');
    service.dismiss();
    expect(service.notice()).toBeNull();
  });
});
