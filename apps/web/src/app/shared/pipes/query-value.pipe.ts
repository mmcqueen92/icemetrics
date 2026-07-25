import { Pipe, type PipeTransform } from '@angular/core';
import type { ParamMap } from '@angular/router';

@Pipe({ name: 'queryValue' })
export class QueryValuePipe implements PipeTransform {
  transform(params: ParamMap | null, name: string): string {
    return params?.get(name) ?? '';
  }
}
