const hook = process.env['RENDER_DEPLOY_HOOK_URL'];
const release = process.argv[2];

if (!hook) {
  throw new Error('RENDER_DEPLOY_HOOK_URL is required.');
}
if (!/^[0-9a-f]{7,40}$/i.test(release ?? '')) {
  throw new Error('A Git commit SHA is required.');
}

const url = new URL(hook);
url.searchParams.set('ref', release);
const response = await fetch(url, { method: 'POST' });
if (!response.ok) {
  throw new Error(`Render rejected deploy hook: HTTP ${response.status}.`);
}
const body = await response.json();
process.stdout.write(
  `${JSON.stringify({ deployId: body.id ?? null, release })}\n`,
);
