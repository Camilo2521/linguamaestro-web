import express from 'express';
// Patches Express so a rejected promise inside an `async (req, res) => {}`
// handler reaches the error-handling middleware below instead of becoming
// an unhandled rejection — Express 4 doesn't do this on its own, and almost
// none of the route handlers in this app have their own try/catch.
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';

import authRoutes from './routes/auth.routes.js';
import onboardingRoutes from './routes/onboarding.routes.js';
import lessonsRoutes from './routes/lessons.routes.js';
import srsRoutes from './routes/srs.routes.js';
import activityRoutes from './routes/activity.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

// CORS_ORIGIN is a comma-separated allowlist (e.g. two Vercel domains, or a
// custom domain + its www variant). Vercel also assigns a unique URL to
// every preview deployment (per branch/PR) that won't be in that list —
// rather than forcing an env var update on every preview, any `*.vercel.app`
// origin is allowed automatically. Tighten this if that's ever undesirable.
function buildCorsOriginChecker() {
  const allowlist = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true); // same-origin / curl / server-to-server
    if (allowlist.includes(origin)) return callback(null, true);
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(null, false);
  };
}

export function createApp() {
  const app = express();

  // Railway (and most PaaS) sit behind a reverse proxy — without this,
  // express-rate-limit and req.ip would see the proxy's address instead of
  // the real client, either breaking rate limiting or throwing on the
  // X-Forwarded-For header it doesn't expect to trust by default.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: buildCorsOriginChecker(), credentials: true }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/auth', authRoutes);
  app.use('/onboarding', onboardingRoutes);
  app.use('/lessons', lessonsRoutes);
  app.use('/srs', srsRoutes);
  app.use('/activity', activityRoutes);
  app.use('/dashboard', dashboardRoutes);

  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Ruta no encontrada' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in (err as unknown as Record<string, unknown>)) {
      // Malformed JSON body from express.json()
      return res.status(400).json({ success: false, error: 'JSON inválido en el cuerpo de la petición' });
    }
    console.error(err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  });

  return app;
}
