import { View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { Screen, T } from '@/components/ui';
import { colors, space } from '@/theme/tokens';

/**
 * Informations de confidentialité, écrites à partir des données réellement traitées (docs/CONFIDENTIALITE.md).
 * Les coordonnées du responsable du traitement et les durées définitives restent à compléter par l'éditeur :
 * rien n'est inventé ici.
 */
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Ce que tu nous confies',
    body: [
      'Ton adresse e-mail et ton mot de passe (géré par notre fournisseur d’authentification, jamais visible en clair) servent à te connecter et à confirmer ton adresse par un code.',
      'Ton prénom, ton pseudo et ta photo de profil sont visibles des personnes avec qui tu partages une cagnotte, de tes amis et des personnes que tu invites.',
      'Dans une cagnotte : tes idées, réactions, votes, messages, missions, mots et photos de capsule, et tes participations.',
    ],
  },
  {
    title: 'Qui voit quoi',
    body: [
      'Le groupe voit le total de la cagnotte, jamais le montant de chacun. Ton vote reste privé, sauf si l’organisation rend les votes visibles.',
      'Les mots et photos de la capsule ne sont lisibles qu’à l’ouverture, et seulement s’ils sont déposés. Un brouillon reste visible de toi seul.',
      'La personne fêtée ne voit que sa capsule : jamais la cagnotte, les idées, les votes, les missions ni la discussion.',
      'Ton adresse e-mail n’est jamais montrée aux autres membres, ni dans la recherche de pseudo.',
    ],
  },
  {
    title: 'Les e-mails',
    body: [
      'E-mails de compte, toujours envoyés : code de confirmation et code de réinitialisation du mot de passe.',
      'E-mail facultatif : l’annonce de l’ouverture d’une capsule, désactivable dans ton profil (« Aussi par e-mail »). Jamais de publicité.',
      'Si quelqu’un t’invite par e-mail sans que tu aies de compte, ton adresse sert seulement à cet envoi. L’invitation expire au bout de 7 jours ; l’organisation peut la renvoyer ou l’annuler.',
    ],
  },
  {
    title: 'Photos',
    body: [
      'Avant l’envoi, les photos sont réduites et leurs métadonnées (position, appareil, date de prise de vue) sont retirées.',
      'Elles sont stockées dans un espace privé et ne s’affichent que par des liens temporaires (10 minutes), aux seules personnes autorisées.',
    ],
  },
  {
    title: 'Tes droits',
    body: [
      'Exporter tes données : Profil › Exporter mes données. Tu reçois tes propres contenus, jamais ceux des autres.',
      'Supprimer ton compte : Profil › Supprimer mon compte. Ton profil, ta photo, tes amis, tes mots et photos de capsule sont supprimés. Tes messages et tes idées restent visibles du groupe, sans ton nom ; tes participations restent dans le total, sans ton nom.',
      'Corriger ton prénom, ton pseudo ou ta photo : Profil › Modifier le profil.',
    ],
  },
  {
    title: 'Prestataires',
    body: [
      'Supabase (base de données, authentification, stockage des photos), Render (serveur COMPLICE) et Brevo (envoi des e-mails). Les régions d’hébergement et les engagements contractuels de chacun sont détaillés dans la politique de confidentialité publiée.',
    ],
  },
];

export default function Privacy() {
  return (
    <Screen>
      <BackHeader title="Tes données" subtitle="Ce que COMPLICE utilise, et pourquoi" fallback="/profile" />
      {SECTIONS.map((s) => (
        <View key={s.title} style={{ gap: space.sm }}>
          <T v="h2" accessibilityRole="header">
            {s.title}
          </T>
          {s.body.map((p) => (
            <T key={p} color={colors.inkSoft}>
              {p}
            </T>
          ))}
        </View>
      ))}
    </Screen>
  );
}
