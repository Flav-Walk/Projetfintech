import type { DataGateway } from './gateway.js';
import { renderEmail, type OutboxRow } from './email-templates.js';
import { MailerError, type Mailer } from './mailer.js';

export interface DrainResult {
  sent: number;
  retried: number;
  failed: number;
  skipped?: 'email_not_configured' | 'admin_not_configured' | 'busy';
}

/**
 * Vide la file d'e-mails métier : réserve un lot (atomique en base), envoie, enregistre le résultat.
 * Une seule exécution à la fois par instance. Les erreurs définitives (adresse refusée, données
 * incomplètes) ne sont pas retentées ; les erreurs temporaires le sont, 3 essais au total (en base).
 */
export class OutboxProcessor {
  private running = false;

  constructor(
    private gateway: DataGateway,
    private mailer: Mailer,
    private publicUrl: string,
    private log: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void } = { info: () => {}, warn: () => {} },
  ) {}

  async drain(limit = 20): Promise<DrainResult> {
    if (!this.mailer.configured) return { sent: 0, retried: 0, failed: 0, skipped: 'email_not_configured' };
    if (!this.gateway.adminConfigured) return { sent: 0, retried: 0, failed: 0, skipped: 'admin_not_configured' };
    if (this.running) return { sent: 0, retried: 0, failed: 0, skipped: 'busy' };
    this.running = true;
    const result: DrainResult = { sent: 0, retried: 0, failed: 0 };
    try {
      const batch = await this.gateway.claimEmails(limit);
      for (const row of batch) {
        try {
          const { messageId } = await this.mailer.send(renderEmail(row as OutboxRow, this.publicUrl));
          await this.gateway.completeEmail(row.id, true, messageId, null);
          result.sent++;
        } catch (err) {
          const retryable = err instanceof MailerError ? err.retryable : false;
          const code = err instanceof Error ? err.message : 'unknown';
          // Erreur définitive : on épuise les essais pour ne pas réessayer inutilement.
          await this.gateway.completeEmail(row.id, false, null, code, !retryable);
          if (retryable && row.attempts < 3) result.retried++;
          else result.failed++;
          this.log.warn({ outbox_id: row.id, kind: row.kind, error: code }, 'e-mail non envoyé');
        }
      }
      if (batch.length) this.log.info({ ...result }, 'file d’e-mails traitée');
      return result;
    } finally {
      this.running = false;
    }
  }
}
