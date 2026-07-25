import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
  selector: 'app-pagination',
  template: `
    <nav class="pagination" aria-label="Results pages">
      <button
        mat-button
        type="button"
        [disabled]="page() <= 1"
        (click)="pageChange.emit(page() - 1)"
      >
        Previous
      </button>
      <span>Page {{ page() }} of {{ totalPages() || 1 }}</span>
      <button
        mat-button
        type="button"
        [disabled]="page() >= totalPages()"
        (click)="pageChange.emit(page() + 1)"
      >
        Next
      </button>
    </nav>
  `,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly pageChange = output<number>();
  readonly totalPages = input.required<number>();
}
