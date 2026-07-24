export interface SnapshotAbsence {
  absenceCount: 1 | 2;
  externalId: string;
}

export interface SnapshotPolicyResult {
  deactivate: readonly string[];
  warnings: readonly SnapshotAbsence[];
}

export function evaluateSnapshotAbsences(
  activeExternalIds: ReadonlySet<string>,
  currentExternalIds: ReadonlySet<string>,
  previousSnapshots: readonly ReadonlySet<string>[],
): SnapshotPolicyResult {
  const deactivate: string[] = [];
  const warnings: SnapshotAbsence[] = [];

  for (const externalId of [...activeExternalIds].sort()) {
    if (currentExternalIds.has(externalId)) {
      continue;
    }
    const absentFromMostRecent =
      previousSnapshots.length >= 1 && !previousSnapshots[0]!.has(externalId);
    const absentFromSecondMostRecent =
      previousSnapshots.length >= 2 && !previousSnapshots[1]!.has(externalId);

    if (absentFromMostRecent && absentFromSecondMostRecent) {
      deactivate.push(externalId);
      continue;
    }
    warnings.push({
      absenceCount: absentFromMostRecent ? 2 : 1,
      externalId,
    });
  }

  return { deactivate, warnings };
}
