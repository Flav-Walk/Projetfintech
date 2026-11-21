/** Page de redirection d'un lien d'invitation : https://<api>/i/<jeton> -> complice://invite/<jeton>. */
export function invitationLandingPage(token: string | null, scheme: string): string {
  const deepLink = token ? `${scheme}://invite/${token}` : null;
  const body = deepLink
    ? `<p>Tu es invité·e à préparer un cadeau commun sur <strong>Complice</strong>.</p>
       <a class="btn" href="${deepLink}">Ouvrir dans l'app</a>
       <p class="hint">Rien ne se passe ? Installe l'app Complice puis rouvre ce lien.<br/>
       En test avec Expo Go, colle ce code dans l'écran « Rejoindre » : <code>${token}</code></p>`
    : `<p>Ce lien d'invitation est incomplet ou invalide. Demande un nouveau lien à l'organisateur.</p>`;
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

function page(body: string, deepLink: string | null): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/><title>Complice</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#FFF6F1;color:#2A1446;display:flex;min-height:100vh;align-items:center;justify-content:center}
  main{max-width:420px;padding:32px 20px;text-align:center}
  h1{font-size:36px;margin:0 0 12px;letter-spacing:-0.5px}
  .btn{display:inline-block;margin:16px 0;padding:16px 28px;border-radius:999px;background:#F2553D;color:#fff;font-weight:700;text-decoration:none}
  .hint{font-size:14px;color:#6B5A7E}
  code{word-break:break-all;background:#F1E9FF;padding:2px 6px;border-radius:6px}
</style></head>
<body><main><h1>complice</h1>${body}</main>
${deepLink ? `<script>setTimeout(function(){location.href=${JSON.stringify(deepLink)}},300)</script>` : ''}
</body></html>`;
}
