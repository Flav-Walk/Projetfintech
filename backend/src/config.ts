import { z } from 'zod';

/** Expo web en local (port Metro par défaut, ancien port web, port des captures de test). */
export const DEV_ORIGINS = ['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:19006', 'http://localhost:8099'];

const ORIGIN_RE = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i;

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  /** Clé secrète serveur (sb_secret_… ou ancienne service_role). Ne jamais l'exposer au client. */
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  /** Schéma de l'app pour les liens profonds (complice://invite/<jeton>). */
  APP_SCHEME: z.string().regex(/^[a-z][a-z0-9+.-]*$/).default('complice'),
  /**
   * Origines web autorisées (CORS), séparées par des virgules. Non définie : origines de développement
   * locales (Expo web). Chaîne vide explicite : aucune origine (app mobile native seulement, qui n'en a pas besoin).
   * Jamais de « * » : chaque origine doit être une URL http(s) complète sans chemin.
   */
  ALLOWED_ORIGINS: z.string().default(DEV_ORIGINS.join(',')),
  /**
   * Nombre de relais (proxys) de confiance devant l'API. Render : 1. L'adresse cliente retenue pour les
   * limites de débit est celle ajoutée par le dernier relais de confiance, jamais la valeur la plus à gauche
   * de X-Forwarded-For (fournie par le client, donc falsifiable). 0 : aucune confiance (adresse du socket).
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  PAYMENT_PROVIDER: z.enum(['simulated']).default('simulated'),
  /** URL publique de cette API (liens des e-mails : /i/<jeton>, /e/<événement>). */
  APP_PUBLIC_URL: z.url().default('https://complice-api.onrender.com'),
  /**
   * E-mails métier via l'API Brevo (invitations, ouverture de la capsule). Clé API Brevo (xkeysib-…),
   * distincte des identifiants SMTP utilisés par Supabase Auth. Absente : aucun e-mail métier.
   */
  BREVO_API_KEY: z.string().min(20).optional(),
  /** Expéditeur validé dans Brevo (Senders, domaine authentifié recommandé). */
  BREVO_FROM_EMAIL: z.email().optional(),
  BREVO_FROM_NAME: z.string().min(1).max(60).default('COMPLICE'),
});

export type Config = z.infer<typeof schema> & { allowedOrigins: string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Configuration invalide ou incomplète : ${fields}. Voir backend/.env.example.`);
  }
  const allowedOrigins = parsed.data.ALLOWED_ORIGINS.split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  const invalid = allowedOrigins.filter((o) => !ORIGIN_RE.test(o));
  if (invalid.length) throw new Error(`ALLOWED_ORIGINS invalide (${invalid.join(', ')}) : URL complètes, sans « * » ni chemin.`);
  return { ...parsed.data, allowedOrigins };
}
