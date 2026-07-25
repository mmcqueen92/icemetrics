import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewChild,
} from '@angular/core';
import type {
  AfterViewInit,
  ElementRef,
  OnChanges,
  OnDestroy,
} from '@angular/core';

export interface ChartSeries {
  name: string;
  values: (number | null)[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-accessible-line-chart',
  styles: `
    .chart {
      block-size: 22rem;
      inline-size: 100%;
    }
  `,
  template: `<div
    #host
    class="chart"
    aria-hidden="true"
    data-testid="analytics-chart"
  ></div>`,
})
export class AccessibleLineChartComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input({ required: true }) categories: string[] = [];
  @Input({ required: true }) series: ChartSeries[] = [];
  @Input({ required: true }) title = '';
  @ViewChild('host', { static: true })
  private readonly host!: ElementRef<HTMLDivElement>;
  private chart?: {
    dispose(): void;
    resize(): void;
    setOption(option: unknown): void;
  };
  private destroyed = false;
  private resizeObserver?: ResizeObserver;

  async ngAfterViewInit(): Promise<void> {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const echarts = await import('echarts');
    if (this.destroyed) {
      return;
    }
    this.chart = echarts.init(this.host.nativeElement);
    this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
    this.resizeObserver.observe(this.host.nativeElement);
    this.render();
  }

  ngOnChanges(): void {
    this.render();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
  }

  private render(): void {
    this.chart?.setOption({
      aria: { enabled: false },
      grid: { bottom: 48, containLabel: true, left: 24, right: 24, top: 56 },
      legend: { bottom: 0 },
      series: this.series.map((series) => ({
        connectNulls: false,
        data: series.values,
        name: series.name,
        showSymbol: this.categories.length < 20,
        smooth: false,
        type: 'line',
      })),
      title: { left: 'center', text: this.title },
      tooltip: { trigger: 'axis' },
      xAxis: { data: this.categories, type: 'category' },
      yAxis: { scale: true, type: 'value' },
    });
  }
}
