import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { SupabaseGateway } from './gateway.js';
import { BrevoMailer } from './mailer.js';
import { SimulatedPaymentProvider } from './payments.js';

const config = loadConfig();
const mailer = new BrevoMailer(config.BREVO_API_KEY, config.BREVO_FROM_EMAIL, config.BREVO_FROM_NAME);
const app = await buildApp({
  config,
  gateway: new SupabaseGateway(config),
  payments: new SimulatedPaymentProvider(),
  mailer,
  version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev',
});

if (!config.SUPABASE_SECRET_KEY) {
  app.log.warn('SUPABASE_SECRET_KEY absente : contributions, suppression de compte et e-mails métier indisponibles.');
}
if (!mailer.configured) {
  app.log.warn('BREVO_API_KEY ou BREVO_FROM_EMAIL absente : aucun e-mail métier ne sera envoyé.');
}

await app.listen({ port: config.PORT, host: config.HOST });

// Tant que l'instance est éveillée, la file est vidée chaque minute (la base la réveille si besoin).
const timer = mailer.configured
  ? setInterval(() => {
      void app.outbox.drain().catch((err: unknown) => app.log.error({ err: err instanceof Error ? err.message : 'unknown' }, 'file d’e-mails'));
    }, 60_000)
  : null;

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (timer) clearInterval(timer);
    app.close().then(() => process.exit(0));
  });
}
