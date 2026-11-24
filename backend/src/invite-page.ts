import { publicHead, PUBLIC_STYLE } from './public-pages.js';

/**
 * Page de redirection d'un lien d'invitation : https://<api>/i/<jeton> -> complice://invite/<jeton>.
 * Texte neutre pour tout le monde : la page ne lit pas la base et ne connaît donc pas le rôle ; la personne
 * fêtée reçoit le même lien que les préparateurs et ne doit rien apprendre de la surprise ici.
 */
export function invitationLandingPage(token: string | null, scheme: string): string {
  const deepLink = token ? `${scheme}://invite/${token}` : null;
  const body = deepLink
    ? `<p>Tu as reçu une invitation personnelle sur <strong>Complice</strong>.</p>
       <a class="btn" href="${deepLink}">Ouvrir dans l'app</a>
       <p class="hint">Rien ne se passe ? Installe l'app Complice puis rouvre ce lien.<br/>
       En test avec Expo Go, colle ce code dans l'écran « Rejoindre » : <code>${token}</code></p>`
    : `<p>Ce lien d'invitation est incomplet ou invalide. Demande un nouveau lien à la personne qui t’a invité·e.</p>`;
  return page(body, deepLink);
}

/** Lien d'un e-mail vers un événement (ouverture de la capsule) : https://<api>/e/<id> -> complice://event/<id>/capsule. */
export function eventLandingPage(eventId: string | null, scheme: string): string {
  const deepLink = eventId ? `${scheme}://event/${eventId}/capsule` : null;
  const body = deepLink
    ? `<p>La capsule t’attend dans l’app <strong>Complice</strong>.</p>
       <a class="btn" href="${deepLink}">Ouvrir dans l'app</a>
       <p class="hint">Rien ne se passe ? Ouvre l’app Complice : l’événement est dans tes souvenirs.</p>`
    : `<p>Ce lien est incomplet. Ouvre l’app Complice : tes événements y sont tous.</p>`;
  return page(body, deepLink);
}

/** Pages privées : jamais indexées, aucun aperçu riche (le titre reste « Complice », rien sur la surprise). */
function page(body: string, deepLink: string | null): string {
  return `<!doctype html>
<html lang="fr"><head>${publicHead({ title: 'Complice', description: null, path: null, index: false })}
<style>${PUBLIC_STYLE}main{text-align:center;max-width:440px}</style></head>
<body><main><h1 class="logo">complice</h1>${body}</main>
${deepLink ? `<script>setTimeout(function(){location.href=${JSON.stringify(deepLink)}},300)</script>` : ''}
</body></html>`;
}

