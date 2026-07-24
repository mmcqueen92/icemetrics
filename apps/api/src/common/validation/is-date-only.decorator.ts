import {
  buildMessage,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function IsDateOnly(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isDateOnly',
      validator: {
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be a valid date in YYYY-MM-DD format`,
          validationOptions,
        ),
        validate: (value: unknown): boolean =>
          typeof value === 'string' &&
          DATE_ONLY_PATTERN.test(value) &&
          isRealDate(value),
      },
    },
    validationOptions,
  );
}

function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
