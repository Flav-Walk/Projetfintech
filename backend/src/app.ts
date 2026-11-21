import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { CONTRIBUTION_MAX_CENTS, CONTRIBUTION_MIN_CENTS } from '@complice/shared';
import type { Config } from './config.js';
import { GatewayError, type DataGateway } from './gateway.js';
import type { PaymentProvider } from './payments.js';
import { eventLandingPage, invitationLandingPage } from './invite-page.js';
import type { Mailer } from './mailer.js';
import { OutboxProcessor } from './outbox.js';

export interface AppDeps {
  config: Config;
  gateway: DataGateway;
  payments: PaymentProvider;
  mailer: Mailer;
  version?: string;
}

const emailInvitationBody = z.object({
  event_id: z.uuid(),
  email: z.email().max(320),
  role: z.enum(['participant', 'co_organizer', 'beneficiary']).default('participant'),
});

const uuid = z.uuid();

const contributionBody = z.object({
  event_id: uuid,
  amount_cents: z.number().int().min(CONTRIBUTION_MIN_CENTS).max(CONTRIBUTION_MAX_CENTS),
  idempotency_key: z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/),
  simulate: z.enum(['success', 'failure']).optional(),
});

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    jwt?: string;
  }
  interface FastifyInstance {
    /** File d'e-mails métier (vidée par le serveur chaque minute et par /internal/outbox/drain). */
    outbox: OutboxProcessor;
  }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config, gateway, payments, mailer } = deps;
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: 'info', redact: ['req.headers.authorization'] },
    trustProxy: true, // Render place l'app derrière un proxy
    bodyLimit: 16 * 1024,
  });

  const outbox = new OutboxProcessor(gateway, mailer, config.APP_PUBLIC_URL, {
    info: (o, m) => app.log.info(o, m),
    warn: (o, m) => app.log.warn(o, m),
  });
  const kickOutbox = () => {
    void outbox.drain().catch((err) => app.log.error({ err: err instanceof Error ? err.message : 'unknown' }, 'file d’e-mails'));
  };

  await app.register(cors, { origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : false });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof GatewayError) return reply.status(err.status).send({ error: err.code });
    if (err instanceof z.ZodError) return reply.status(400).send({ error: 'invalid_request', details: err.issues.map((i) => i.path.join('.')) });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.status(status).send({ error: status === 429 ? 'rate_limited' : status >= 500 ? 'unknown' : 'invalid_request' });
  });

  async function requireUser(req: FastifyRequest) {
    const header = req.headers.authorization ?? '';
    const jwt = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!jwt) throw new GatewayError('not_authenticated', 401);
    const user = await gateway.verifyUser(jwt);
    if (!user) throw new GatewayError('not_authenticated', 401);
    req.userId = user.id;
    req.jwt = jwt;
  }

  // ------------------------------------------------------------ santé (Render health check)
  app.get('/health', async () => ({
    status: 'ok',
    version: deps.version ?? 'dev',
    payment_provider: payments.name,
    admin_configured: gateway.adminConfigured,
    email_configured: mailer.configured,
    time: new Date().toISOString(),
  }));

  // ------------------------------------------------------------ lien d'un e-mail vers un événement
  // Même principe que /i/<jeton> : aucune lecture en base, l'app vérifie les droits à l'ouverture.
  app.get<{ Params: { id: string } }>('/e/:id', async (req, reply) => {
    const ok = uuid.safeParse(req.params.id).success;
    return reply
      .status(ok ? 200 : 404)
      .header('Cache-Control', 'no-store')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Robots-Tag', 'noindex')
      .type('text/html')
      .send(eventLandingPage(ok ? req.params.id : null, config.APP_SCHEME));
  });

  // ------------------------------------------------------------ lien d'invitation partageable
  // Page web neutre : ne consulte pas la base (aucune fuite), propose d'ouvrir l'app.
  app.get<{ Params: { token: string } }>('/i/:token', async (req, reply) => {
    const token = req.params.token;
    if (!/^[a-f0-9]{64}$/.test(token)) return reply.status(404).type('text/html').send(invitationLandingPage(null, config.APP_SCHEME));
    return reply
      .header('Cache-Control', 'no-store')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Robots-Tag', 'noindex')
      .type('text/html')
      .send(invitationLandingPage(token, config.APP_SCHEME));
  });

  // ------------------------------------------------------------ contributions simulées
  app.post('/v1/contributions', { preHandler: requireUser }, async (req, reply) => {
    const body = contributionBody.parse(req.body);
    const created = await gateway.createContribution(req.jwt!, body.event_id, body.amount_cents, body.idempotency_key);
    // Requête rejouée : on renvoie l'état connu, sans nouveau débit.
    if (created.status !== 'pending') return reply.status(200).send(created);
    const result = await payments.charge({ contributionId: created.id, amountCents: created.amount_cents, simulate: body.simulate });
    const settled = await gateway.settleContribution(created.id, result.success, result.providerRef, result.failureReason);
    return reply.status(201).send(settled);
  });

  app.get<{ Querystring: { event_id?: string } }>('/v1/contributions', { preHandler: requireUser }, async (req) => {
    const eventId = req.query.event_id ? uuid.parse(req.query.event_id) : undefined;
    return { contributions: await gateway.listMyContributions(req.jwt!, eventId) };
  });

  // ------------------------------------------------------------ suppression de compte
  app.delete('/v1/account', { preHandler: requireUser, config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ confirm: z.literal('SUPPRIMER') }).parse(req.body ?? {});
    void body;
    await gateway.deleteAccount(req.userId!);
    return reply.status(204).send();
  });

  // ------------------------------------------------------------ invitation par e-mail
  // Droits et doublons contrôlés en SQL (prepare_email_invitation) ; l'envoi part de la file.
  app.post('/v1/invitations/email', { preHandler: requireUser, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = emailInvitationBody.parse(req.body);
    if (!mailer.configured) throw new GatewayError('email_not_configured', 503);
    const result = await gateway.prepareEmailInvitation(req.jwt!, body.event_id, body.role, body.email);
    kickOutbox();
    return reply.status(202).send(result);
  });

  // ------------------------------------------------------------ envoi de la file d'e-mails
  // Appelé par la base (pg_cron + pg_net) quand des e-mails attendent, ce qui réveille aussi l'instance.
  // Sans effet de bord hors de la file elle-même : pas besoin d'authentification, débit limité.
  app.post('/internal/outbox/drain', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async () => outbox.drain());

  app.decorate('outbox', outbox);
  return app;
}
