const apiBaseUrl = requiredUrl('API_BASE_URL');
const webBaseUrl = requiredUrl('WEB_BASE_URL');
const expectedRelease = process.env['EXPECTED_RELEASE'];
const attempts = Number(process.env['SMOKE_ATTEMPTS'] ?? 30);
const intervalMs = Number(process.env['SMOKE_INTERVAL_MS'] ?? 10_000);

if (!/^[0-9a-f]{7,40}$/i.test(expectedRelease ?? '')) {
  throw new Error('EXPECTED_RELEASE must be a Git commit SHA.');
}

const apiOrigin = new URL(apiBaseUrl).origin;
await waitForRelease();
await expectOk(new URL('/health/ready', apiOrigin));
const web = await expectOk(webBaseUrl);
if (!web.toLowerCase().includes('<!doctype html')) {
  throw new Error('Web smoke check did not receive the Angular application.');
}
const releaseAsset = await findReleaseAsset(web);
if (!releaseAsset) {
  throw new Error('Web assets do not contain the expected release metadata.');
}

const seasons = await collection('/seasons?page=1&pageSize=1');
const season = requiredItem(seasons, 'season');
const players = await collection('/players?page=1&pageSize=1');
const player = requiredItem(players, 'player');
await single(`/players/${encodeURIComponent(player.id)}`);
await collection('/teams?page=1&pageSize=100');
await collection(`/standings?seasonId=${encodeURIComponent(season.id)}`);
await collection(
  `/games?seasonId=${encodeURIComponent(season.id)}&page=1&pageSize=1`,
);
await collection(
  `/analytics/teams/rankings?seasonId=${encodeURIComponent(season.id)}`,
);

process.stdout.write(
  `${JSON.stringify({
    apiBaseUrl: apiBaseUrl.toString(),
    checkedAt: new Date().toISOString(),
    release: expectedRelease,
    status: 'ok',
    webBaseUrl: webBaseUrl.toString(),
  })}\n`,
);

async function waitForRelease() {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = JSON.parse(
        await expectOk(new URL('/health/live', apiOrigin)),
      );
      if (response.release === expectedRelease) return;
    } catch {
      // The service can be unavailable while Render swaps instances.
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw new Error(`Release ${expectedRelease} did not become live.`);
}

async function collection(path) {
  const body = JSON.parse(await expectOk(new URL(path, apiBaseUrl)));
  if (!Array.isArray(body.data)) {
    throw new Error(`${path} did not return a collection envelope.`);
  }
  return body.data;
}

async function single(path) {
  const body = JSON.parse(await expectOk(new URL(path, apiBaseUrl)));
  if (!body.data || typeof body.data !== 'object') {
    throw new Error(`${path} did not return a resource envelope.`);
  }
  return body.data;
}

async function expectOk(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'icemetrics-deployment-smoke/1' },
  });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }
  return response.text();
}

async function findReleaseAsset(html) {
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(
    (match) => match[1],
  );
  for (const path of scripts) {
    const body = await expectOk(new URL(path, webBaseUrl));
    if (body.includes(expectedRelease)) return true;
  }
  return false;
}

function requiredItem(values, name) {
  if (!values[0]?.id) {
    throw new Error(`Deployment has no ${name} data for smoke verification.`);
  }
  return values[0];
}

function requiredUrl(name) {
  const value = process.env[name];
  if (!value?.startsWith('https://')) {
    throw new Error(`${name} must be an HTTPS URL.`);
  }
  return new URL(value.endsWith('/') ? value : `${value}/`);
}
