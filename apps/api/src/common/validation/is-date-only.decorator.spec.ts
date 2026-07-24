import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { IsDateOnly } from './is-date-only.decorator.js';

class DateFixture {
  @IsDateOnly()
  value!: unknown;
}

describe('IsDateOnly', () => {
  it('accepts a real YYYY-MM-DD calendar date', async () => {
    const fixture = new DateFixture();
    fixture.value = '2024-02-29';
    await expect(validate(fixture)).resolves.toEqual([]);
  });

  it.each(['2025-02-29', '2025/02/28', 20250228])(
    'rejects invalid date-only value %s',
    async (value) => {
      const fixture = new DateFixture();
      fixture.value = value;
      const errors = await validate(fixture);
      expect(errors[0]?.constraints).toHaveProperty('isDateOnly');
    },
  );
});
