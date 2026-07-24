import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorDetailDto {
  @ApiProperty({ example: 'page' })
  field!: string;

  @ApiProperty({ example: 'MIN_VALUE' })
  code!: string;

  @ApiProperty({ example: 'page must be at least 1' })
  message!: string;
}

export class ApiErrorBodyDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'The request contains invalid values.' })
  message!: string;

  @ApiProperty({ type: [ApiErrorDetailDto] })
  details!: ApiErrorDetailDto[];

  @ApiProperty({
    example: '0d9de4ac-57b8-4cb4-8895-33bcb4eb3396',
    format: 'uuid',
  })
  requestId!: string;

  @ApiProperty({
    example: '2026-07-22T20:00:00.000Z',
    format: 'date-time',
  })
  timestamp!: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: ApiErrorBodyDto })
  error!: ApiErrorBodyDto;
}
