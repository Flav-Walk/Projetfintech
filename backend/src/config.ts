import { z } from 'zod';

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
  /** Origines autorisées (CORS) séparées par des virgules ; vide = aucune (app mobile native). */
  ALLOWED_ORIGINS: z.string().default(''),
  PAYMENT_PROVIDER: z.enum(['simulated']).default('simulated'),
});

export type Config = z.infer<typeof schema> & { allowedOrigins: string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Configuration invalide ou incomplète : ${fields}. Voir backend/.env.example.`);
  }
  return {
    ...parsed.data,
    allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  };
}
