const [implementationPass, capability] = process.argv.slice(2);

if (!implementationPass || !capability) {
  throw new Error(
    'pass-not-ready requires an implementation pass and capability',
  );
}

console.error(
  `${capability} is intentionally unavailable until ${implementationPass}.`,
);
process.exitCode = 1;
