/**
 * Modèles des e-mails métier COMPLICE (français, une colonne, lisibles sur téléphone).
 * Aucune donnée financière : ni objectif, ni montant, ni prix.
 * Tout contenu saisi par un utilisateur (titres, prénoms) est échappé.
 */
import type { OutgoingEmail } from './mailer.js';

export interface OutboxRow {
  id: number;
  kind: 'invitation' | 'capsule_open';
  to_email: string;
  event_id: string | null;
  payload: Record<string, unknown>;
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const str = (v: unknown, fallback = '') => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

function layout({ preheader, title, paragraphs, cta, footnote }: { preheader: string; title: string; paragraphs: string[]; cta: { label: string; url: string }; footnote: string }) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#FFF7F2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7F2;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:20px;border:1px solid #F0E6E0;">
<tr><td style="padding:28px 24px 8px;font-family:Arial,Helvetica,sans-serif;color:#2A1446;">
<div style="font-size:26px;font-weight:900;letter-spacing:-0.5px;color:#2A1446;">complice</div>
<h1 style="font-size:22px;line-height:28px;margin:20px 0 12px;color:#2A1446;">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="font-size:16px;line-height:24px;margin:0 0 14px;color:#2A1446;">${p}</p>`).join('\n')}
</td></tr>
<tr><td align="center" style="padding:8px 24px 24px;">
<a href="${esc(cta.url)}" style="display:inline-block;background:#F2553D;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;text-decoration:none;padding:16px 28px;border-radius:16px;">${esc(cta.label)}</a>
</td></tr>
<tr><td style="padding:0 24px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#6B5A7E;">
${footnote}<br><br>Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :<br><span style="word-break:break-all;color:#6A4BF5;">${esc(cta.url)}</span>
</td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#A99BB8;margin:16px 0 0;">COMPLICE — le cadeau commun qu’on prépare ensemble.</p>
</td></tr></table></body></html>`;
}

export function renderEmail(row: OutboxRow, publicUrl: string): OutgoingEmail {
  const p = row.payload;
  const base = publicUrl.replace(/\/+$/, '');
  if (row.kind === 'invitation') {
    const token = str(p.token);
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('invitation_token_missing');
    const inviter = str(p.inviter_name, 'Un proche');
    const title = str(p.event_title, 'un cadeau commun');
    const beneficiary = str(p.beneficiary_name);
    const isBeneficiary = p.role === 'beneficiary';
    const url = `${base}/i/${token}`;
    const intro = isBeneficiary
      ? `${esc(inviter)} t’invite sur COMPLICE pour « ${esc(title)} ». Tu découvriras les mots et le cadeau préparés par tes proches le jour de l’ouverture : rien ne t’est montré avant.`
      : `${esc(inviter)} t’invite à préparer ensemble « ${esc(title)} »${beneficiary ? ` pour ${esc(beneficiary)}` : ''} : idées de cadeau, votes, cagnotte et capsule de mots.`;
    return {
      to: row.to_email,
      tag: 'invitation',
      subject: isBeneficiary ? `${inviter} te prépare une surprise sur COMPLICE` : `${inviter} t’invite à préparer un cadeau commun`,
      html: layout({
        preheader: `Rejoins « ${title} » sur COMPLICE.`,
        title: isBeneficiary ? 'Une surprise se prépare' : 'Tu es invité·e !',
        paragraphs: [intro, 'Ouvre le lien depuis ton téléphone : tu pourras créer ton compte et tu arriveras directement dans le groupe.'],
        cta: { label: 'Rejoindre le groupe', url },
        footnote: 'Ce lien est personnel, à usage unique et valable 7 jours. Tu n’attendais pas cette invitation ? Ignore simplement ce message : aucun compte n’est créé sans toi.',
      }),
      text: `${isBeneficiary ? 'Une surprise se prépare' : 'Tu es invité·e !'}\n\n${intro.replace(/&[a-z#0-9]+;/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[m] ?? m)}\n\nRejoindre le groupe : ${url}\n\nLien personnel, à usage unique, valable 7 jours. Tu n’attendais pas cette invitation ? Ignore ce message.`,
    };
  }
  // capsule_open
  if (!row.event_id) throw new Error('event_missing');
  const name = str(p.display_name);
  const title = str(p.event_title, 'ta capsule');
  const beneficiary = str(p.beneficiary_name, 'la personne fêtée');
  const mine = p.is_beneficiary === true;
  const url = `${base}/e/${row.event_id}`;
  const line = mine
    ? `Tes proches t’ont préparé des mots, des photos et un cadeau. La capsule « ${esc(title)} » est ouverte : c’est le moment de la découvrir.`
    : `La capsule « ${esc(title)} » est ouverte : ${esc(beneficiary)} peut découvrir vos mots et vos photos. Les souvenirs restent accessibles à tout le groupe.`;
  return {
    to: row.to_email,
    tag: 'capsule_open',
    subject: mine ? 'Ta capsule COMPLICE est ouverte' : `La capsule pour ${beneficiary} est ouverte`,
    html: layout({
      preheader: mine ? 'Des mots et des photos t’attendent.' : 'Les souvenirs sont disponibles.',
      title: mine ? `${name ? `${esc(name)}, ta` : 'Ta'} capsule est ouverte` : 'La capsule est ouverte',
      paragraphs: [line],
      cta: { label: mine ? 'Découvrir ma capsule' : 'Revivre les souvenirs', url },
      footnote: 'Tu reçois cet e-mail parce que tu fais partie de ce groupe COMPLICE. Tu peux désactiver les e-mails dans ton profil, rubrique Notifications.',
    }),
    text: `${mine ? 'Ta capsule est ouverte' : 'La capsule est ouverte'}\n\n${line.replace(/&[a-z#0-9]+;/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[m] ?? m)}\n\n${url}\n\nDésactiver ces e-mails : profil > Notifications.`,
  };
}
