import 'dotenv/config';

// Fail fast with a readable message instead of a Supabase stack trace when
// the deployment is missing configuration. Checked before app.js is loaded,
// because lib/supabase.ts creates its clients at import time.
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]?.trim());
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const { createApp } = await import('./app.js');
const app = createApp();
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`LinguaMaestro API listening on http://localhost:${port}`);
});
