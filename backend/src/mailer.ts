/**
 * Envoi d'e-mails transactionnels. Implémentation Brevo (API HTTP v3) ; un double en mémoire sert aux tests.
 * La clé API ne quitte jamais ce module : elle n'est ni journalisée ni renvoyée dans une erreur.
 */
export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Catégorie Brevo (statistiques) : invitation, capsule_open. */
  tag: string;
}

export interface Mailer {
  readonly configured: boolean;
  send(email: OutgoingEmail): Promise<{ messageId: string | null }>;
}

export class MailerError extends Error {
  constructor(
    message: string,
    /** Vrai si un nouvel essai a un sens (réseau, 429, 5xx). */
    public retryable: boolean,
  ) {
    super(message);
  }
}

export class BrevoMailer implements Mailer {
  readonly configured: boolean;

  constructor(
    private apiKey: string | undefined,
    private fromEmail: string | undefined,
    private fromName: string,
    private fetchImpl: typeof fetch = fetch,
  ) {
    this.configured = !!apiKey && !!fromEmail;
  }

  async send(email: OutgoingEmail) {
    if (!this.configured) throw new MailerError('email_not_configured', false);
    let res: Response;
    try {
      res = await this.fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': this.apiKey!, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: this.fromEmail, name: this.fromName },
          to: [{ email: email.to }],
          subject: email.subject,
          htmlContent: email.html,
          textContent: email.text,
          tags: [email.tag],
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new MailerError('network_error', true);
    }
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { messageId?: string };
      return { messageId: body.messageId ?? null };
    }
    // Message d'erreur Brevo résumé (code HTTP + code Brevo), sans en-têtes ni clé.
    const detail = (await res.json().catch(() => ({}))) as { code?: string };
    throw new MailerError(`brevo_${res.status}${detail.code ? `_${detail.code}` : ''}`, res.status === 429 || res.status >= 500);
  }
}
