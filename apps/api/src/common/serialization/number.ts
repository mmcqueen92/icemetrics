export function roundToFour(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

export function percentage(
  numerator: number,
  denominator: number,
): number | null {
  return denominator === 0
    ? null
    : roundToFour((100 * numerator) / denominator);
}
