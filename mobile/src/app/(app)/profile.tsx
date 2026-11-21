import { messageFor } from '@complice/shared';
import { router } from 'expo-router';
import { LogOut, ShieldCheck, User } from 'lucide-react-native';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { ConfirmButton } from '@/components/confirm-button';
import { Avatar } from '@/components/event-parts';
import { Banner, Button, Card, Field, Row, Screen, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { signOutAfterDeletion, signOutEverywhere, useAuth } from '@/lib/auth';
import { isApiConfigured } from '@/lib/env';
import { usePrefs, useProfile, useUpdatePrefs, useUpdateProfile } from '@/lib/queries';
import type { NotificationPrefs } from '@/lib/types';
import { colors, space } from '@/theme/tokens';

const PREFS: { key: keyof Omit<NotificationPrefs, 'user_id'>; label: string; hint: string }[] = [
  { key: 'invitations', label: 'Invitations', hint: 'Quand on t’invite dans un groupe.' },
  { key: 'votes', label: 'Votes', hint: 'Fin de vote proche, cadeau choisi.' },
  { key: 'tasks', label: 'Missions', hint: 'Quand une mission t’est attribuée.' },
  { key: 'capsule', label: 'Capsule', hint: 'Ouverture de la capsule.' },
  { key: 'messages', label: 'Discussion', hint: 'Nouveaux messages (désactivé par défaut).' },
  { key: 'emails', label: 'Aussi par e-mail', hint: 'L’ouverture de la capsule t’est aussi annoncée par e-mail. Jamais de publicité.' },
];

export default function ProfileScreen() {
  const { session } = useAuth();
  const profile = useProfile();
  const update = useUpdateProfile();
  const prefs = usePrefs();
  const updatePrefs = useUpdatePrefs();
  const [draft, setName] = useState<string | null>(null);
  const name = draft ?? profile.data?.display_name ?? '';
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function saveName() {
    setMsg(null);
    if (name.trim().length < 1 || name.trim().length > 40) return setMsg({ tone: 'error', text: 'Prénom entre 1 et 40 caractères.' });
    try {
      await update.mutateAsync({ display_name: name.trim() });
      setMsg({ tone: 'info', text: 'Profil mis à jour.' });
    } catch (e) {
      setMsg({ tone: 'error', text: messageFor(e) });
    }
  }

  async function deleteAccount() {
    setMsg(null);
    setDeleting(true);
    try {
      await api.deleteAccount();
      await signOutAfterDeletion();
      router.replace('/welcome');
    } catch (e) {
      setDeleting(false);
      const code = e instanceof ApiError ? e.code : '';
      setMsg({
        tone: 'error',
        text:
          code === 'api_not_configured'
            ? 'La suppression passe par le serveur, qui n’est pas encore configuré (EXPO_PUBLIC_API_URL).'
            : code === 'server_not_configured'
              ? 'Le serveur n’a pas encore sa clé d’administration : suppression impossible pour le moment.'
              : messageFor(e),
      });
    }
  }

  return (
    <Screen>
      <BackHeader title="Mon profil" fallback="/events" />
      <Row>
        <Avatar name={profile.data?.display_name ?? '?'} size={56} />
        <View style={{ flex: 1 }}>
          <T v="h3">{profile.data?.display_name}</T>
          <T v="small" color={colors.inkSoft}>
            {session?.user.email}
          </T>
        </View>
      </Row>
      {msg ? <Banner tone={msg.tone}>{msg.text}</Banner> : null}
      <Field label="Prénom affiché" value={name} onChangeText={setName} maxLength={40} icon={<User size={20} color={colors.inkSoft} strokeWidth={1.75} />} />
      <Button label="Enregistrer" variant="outline" onPress={saveName} loading={update.isPending} />

      <T v="h2">Notifications dans l’app</T>
      <Card style={{ gap: space.md }}>
        {PREFS.map((p) => (
          <Row key={p.key} style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T v="bodyBold">{p.label}</T>
              <T v="small" color={colors.inkSoft}>
                {p.hint}
              </T>
            </View>
            <Switch
              value={prefs.data?.[p.key] ?? false}
              disabled={!prefs.data}
              onValueChange={(v) => updatePrefs.mutate({ [p.key]: v })}
              trackColor={{ true: colors.violet, false: colors.border }}
              accessibilityLabel={`Notifications : ${p.label}`}
            />
          </Row>
        ))}
        <T v="small" color={colors.inkSoft}>
          Les notifications push sur le téléphone ne sont pas encore actives : tout apparaît dans la cloche de l’accueil. Une même alerte n’est jamais envoyée deux fois.
        </T>
      </Card>

      <T v="h2">Tes données</T>
      <Card style={{ gap: space.sm }}>
        <Row gap={space.sm}>
          <ShieldCheck size={22} color={colors.violet} strokeWidth={1.75} />
          <T v="bodyBold">Ce que Complice conserve</T>
        </Row>
        <T v="small" color={colors.inkSoft}>
          Ton e-mail et ton prénom ; les événements que tu rejoins ; tes idées, votes, messages, mots et photos ; tes participations (simulées à ce stade, aucun paiement réel). Ton montant n’est visible que par toi. Ton vote est privé sauf si l’organisateur rend les votes visibles.
        </T>
        <T v="small" color={colors.inkSoft}>
          Si tu supprimes ton compte : ton profil, tes mots de capsule et tes photos sont supprimés ; tes messages restent sans nom ; tes participations restent dans le total, sans ton nom. Si tu organises un événement, l’organisation passe au coorganisateur le plus ancien, sinon au participant le plus ancien ; un événement sans autre membre est supprimé.
        </T>
      </Card>

      <Button
        label="Se déconnecter"
        variant="outline"
        icon={<LogOut size={20} color={colors.ink} strokeWidth={1.75} />}
        loading={signingOut}
        onPress={async () => {
          setSigningOut(true);
          await signOutEverywhere();
        }}
        accessibilityHint="Les brouillons enregistrés sur ce téléphone sont effacés."
      />
      <Card style={{ gap: space.sm, borderColor: colors.dangerSoft }}>
        <T v="h3" color={colors.danger}>
          Supprimer mon compte
        </T>
        <T v="small" color={colors.inkSoft}>
          Action définitive et immédiate : ton profil, tes mots, tes photos et tes brouillons sont effacés ; tu perds l’accès à tes groupes. Tes participations restent comptées dans les cagnottes, sans ton nom. Aucune autre étape ne te sera demandée.
          {!isApiConfigured ? ' Nécessite le serveur Complice (non configuré dans cette version).' : ''}
        </T>
        <ConfirmButton label="Supprimer mon compte" confirmLabel="Confirmer : supprimer définitivement" loading={deleting} onConfirm={deleteAccount} />
      </Card>
    </Screen>
  );
}
