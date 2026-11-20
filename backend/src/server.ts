import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { SupabaseGateway } from './gateway.js';
import { SimulatedPaymentProvider } from './payments.js';

const config = loadConfig();
const app = await buildApp({
  config,
  gateway: new SupabaseGateway(config),
  payments: new SimulatedPaymentProvider(),
  version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev',
});

if (!config.SUPABASE_SECRET_KEY) {
  app.log.warn('SUPABASE_SECRET_KEY absente : contributions et suppression de compte renverront 503.');
}

await app.listen({ port: config.PORT, host: config.HOST });

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0));
  });
}
