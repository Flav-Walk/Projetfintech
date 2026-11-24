/**
 * Pages web publiques de Complice, servies par l'API (seul domaine réellement déployé : APP_PUBLIC_URL).
 * - `/` : présentation ; `/confidentialite` : informations sur les données. Indexables.
 * - `/i/<jeton>`, `/e/<id>` : liens privés, jamais indexés (voir invite-page.ts), interdits dans robots.txt.
 * Les écrans de l'app (cagnottes, capsules, profils) ne sont pas des pages web publiques.
 * Rien d'inventé : pas d'avis, de note, de lien de magasin d'applications ni de données structurées commerciales.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#24123D"/><rect x="14" y="27" width="36" height="25" rx="4" fill="#FBF5EE"/><rect x="11" y="20" width="42" height="10" rx="3" fill="#EF4E36"/><rect x="29" y="20" width="6" height="32" fill="#FFC23D"/><path d="M32 20c-6-10-15-6-11-1 2 2 8 2 11 1zm0 0c6-10 15-6 11-1-2 2-8 2-11 1z" fill="#FFC23D"/></svg>`;

export const PUBLIC_STYLE = `
  :root{color-scheme:light}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#FBF5EE;color:#24123D;line-height:1.55;display:flex;justify-content:center}
  main{max-width:680px;padding:40px 20px 56px}
  .logo{font-size:34px;letter-spacing:-0.8px;margin:0 0 8px}
  h1{font-size:34px;line-height:1.15;letter-spacing:-0.6px;margin:8px 0 12px}
  h2{font-size:21px;margin:32px 0 8px}
  p,li{font-size:17px;color:#5E4E72}
  strong{color:#24123D}
  .btn{display:inline-block;margin:16px 0;padding:16px 28px;border-radius:999px;background:#D23A22;color:#fff;font-weight:700;text-decoration:none}
  .hint{font-size:14px;color:#7B697D}
  code{word-break:break-all;background:#F1E5D8;padding:2px 6px;border-radius:6px}
  a{color:#24123D}
  .note{background:#FFF0C9;border-radius:14px;padding:12px 16px;color:#6E4A00;font-size:15px}
  footer{margin-top:40px;font-size:14px;color:#7B697D}
`;

/** En-tête commun : titre, description, canonique et Open Graph seulement pour les pages indexables. */
export function publicHead(o: { title: string; description: string | null; path: string | null; index: boolean; baseUrl?: string }) {
  const canonical = o.index && o.path && o.baseUrl ? `${o.baseUrl}${o.path}` : null;
  return [
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>',
    `<title>${esc(o.title)}</title>`,
    `<meta name="robots" content="${o.index ? 'index,follow' : 'noindex,nofollow'}"/>`,
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>',
    '<meta name="theme-color" content="#FBF5EE"/>',
    o.description ? `<meta name="description" content="${esc(o.description)}"/>` : '',
    canonical ? `<link rel="canonical" href="${esc(canonical)}"/>` : '',
    canonical ? `<meta property="og:type" content="website"/><meta property="og:site_name" content="Complice"/><meta property="og:locale" content="fr_FR"/>` : '',
    canonical ? `<meta property="og:title" content="${esc(o.title)}"/><meta property="og:url" content="${esc(canonical)}"/>` : '',
    canonical && o.description ? `<meta property="og:description" content="${esc(o.description)}"/>` : '',
    canonical ? `<meta property="og:image" content="${esc(o.baseUrl + '/og-image.png')}"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:image:alt" content="Complice : un cadeau commun, des mots dans une capsule"/><meta name="twitter:card" content="summary_large_image"/>` : '',
  ].join('');
}

const HOME_DESCRIPTION = 'Complice aide un groupe d’amis à préparer un cadeau commun : idées et votes, cagnotte au total partagé, missions, et une capsule de mots et de photos découverte le jour J.';

export function homePage(baseUrl: string): string {
  return `<!doctype html><html lang="fr"><head>${publicHead({ title: 'Complice · le cadeau commun, sans prise de tête', description: HOME_DESCRIPTION, path: '/', index: true, baseUrl })}
<style>${PUBLIC_STYLE}</style></head><body><main>
<p class="logo">complice</p>
<h1>Offrez à plusieurs, sans prise de tête.</h1>
<p>Complice réunit le groupe qui prépare une surprise : on propose des idées, on vote, on suit la cagnotte et on se répartit les missions. Le jour J, la personne fêtée ouvre une capsule de mots et de photos laissés par ses proches.</p>
<h2>Comment ça marche</h2>
<ul>
<li><strong>Des idées et un vote</strong> pour choisir le cadeau ensemble.</li>
<li><strong>Une cagnotte</strong> dont le groupe voit le total, jamais le montant de chacun.</li>
<li><strong>Des missions</strong> pour savoir qui commande, emballe ou apporte le cadeau.</li>
<li><strong>Une capsule</strong> scellée jusqu’à la date choisie, puis ouverte par la personne fêtée.</li>
</ul>
<p class="note">Complice est en préparation : l’application n’est pas encore publiée dans les magasins d’applications, et les participations sont simulées (aucun paiement réel).</p>
<h2>Vos données</h2>
<p>La personne fêtée ne voit jamais la cagnotte ni les préparatifs. Les photos sont stockées dans un espace privé, sans leurs métadonnées. <a href="/confidentialite">Tout savoir sur vos données</a>.</p>
<footer>Complice · <a href="/confidentialite">Confidentialité</a></footer>
</main></body></html>`;
}

export function privacyPage(baseUrl: string): string {
  return `<!doctype html><html lang="fr"><head>${publicHead({ title: 'Confidentialité · Complice', description: 'Quelles données Complice utilise, qui y a accès, combien de temps elles sont conservées et comment exercer vos droits.', path: '/confidentialite', index: true, baseUrl })}
<style>${PUBLIC_STYLE}</style></head><body><main>
<p class="logo"><a href="/" style="text-decoration:none">complice</a></p>
<h1>Vos données dans Complice</h1>
<p class="note">Version de travail. Les coordonnées du responsable du traitement, le contact pour exercer vos droits et les durées de conservation définitives seront précisés avant la publication de l’application.</p>
<h2>Ce que nous traitons</h2>
<ul>
<li><strong>Compte</strong> : adresse e-mail, mot de passe (jamais stocké en clair), prénom, pseudo, photo de profil.</li>
<li><strong>Relations</strong> : demandes d’ami, amitiés et blocages.</li>
<li><strong>Cagnottes</strong> : rôle dans le groupe, idées, réactions, votes, missions, messages, mots et photos de capsule, remerciements.</li>
<li><strong>Participations</strong> : montant et statut de vos participations (actuellement simulées, aucun moyen de paiement collecté).</li>
<li><strong>Invitations</strong> : pour inviter une personne sans compte, son adresse e-mail sert uniquement à l’envoi de l’invitation.</li>
<li><strong>Données techniques</strong> : journaux du serveur (adresse IP, requêtes) pour la sécurité et le bon fonctionnement.</li>
</ul>
<h2>Qui voit quoi</h2>
<ul>
<li>Le groupe voit le total de la cagnotte, jamais la part de chacun.</li>
<li>Les mots et photos de la capsule ne sont lisibles qu’à l’ouverture ; un brouillon reste visible de son auteur seul.</li>
<li>La personne fêtée ne voit que sa capsule : ni la cagnotte, ni les idées, ni les votes, ni les missions, ni la discussion.</li>
<li>Votre adresse e-mail n’est jamais montrée aux autres membres ni dans la recherche de pseudo.</li>
</ul>
<h2>E-mails</h2>
<p>Les e-mails de compte (codes de confirmation et de réinitialisation) sont toujours envoyés. L’annonce de l’ouverture d’une capsule est facultative et se désactive dans le profil. Aucune publicité.</p>
<h2>Prestataires</h2>
<p>Supabase (base de données, authentification, stockage), Render (serveur Complice) et Brevo (envoi des e-mails). Leurs régions d’hébergement et engagements contractuels sont indiqués dans la version publiée de cette page.</p>
<h2>Vos droits</h2>
<p>Depuis l’application : exporter vos données (Profil › Exporter mes données), corriger votre profil, supprimer votre compte (Profil › Supprimer mon compte). À la suppression, votre profil, votre photo, vos amis, vos mots et photos de capsule sont supprimés ; vos messages et idées restent visibles du groupe sans votre nom ; vos participations restent dans le total, sans votre nom.</p>
<footer><a href="/">Accueil</a></footer>
</main></body></html>`;
}

export function robotsTxt(baseUrl: string): string {
  // Indication pour les robots, pas un contrôle d'accès : les liens privés sont aussi en noindex et no-store.
  return `User-agent: *\nAllow: /$\nAllow: /confidentialite\nDisallow: /i/\nDisallow: /e/\nDisallow: /v1/\nDisallow: /internal/\nSitemap: ${baseUrl}/sitemap.xml\n`;
}

export function sitemapXml(baseUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${baseUrl}/</loc></url>\n<url><loc>${baseUrl}/confidentialite</loc></url>\n</urlset>\n`;
}
