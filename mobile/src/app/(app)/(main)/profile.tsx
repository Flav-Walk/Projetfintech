import { messageFor } from '@complice/shared';
import { router } from 'expo-router';
import { AtSign, Ban, Camera, Check, Download, LogOut, ShieldCheck, Trash2, User } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserAvatar } from '@/components/avatar';
import { ConfirmButton } from '@/components/confirm-button';
import { ScreenHeader } from '@/components/headers';
import { Divider, Group, ListRow, SectionHeader, Sheet, Toggle } from '@/components/kit';
import { Banner, Button, Field, Row, T } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { signOutAfterDeletion, signOutEverywhere, useAuth } from '@/lib/auth';
import { isApiConfigured } from '@/lib/env';
import { hapticSuccess } from '@/lib/haptics';
import { pickImage, uploadImage } from '@/lib/media';
import { usePrefs, useProfile, useUpdatePrefs, useUpdateProfile } from '@/lib/queries';
import { normalizeQuery, USERNAME_RE, useBlocked, useSetUsername, useUnblockUser, useUsernameAvailable } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { NotificationPrefs } from '@/lib/types';
import { colors, gutter, space } from '@/theme/tokens';

const PREFS: { key: keyof Omit<NotificationPrefs, 'user_id'>; label: string; hint: string }[] = [
  { key: 'invitations', label: 'Invitations', hint: 'Quand on t’invite dans une cagnotte.' },
  { key: 'friends', label: 'Amis', hint: 'Demandes d’ami et acceptations.' },
  { key: 'votes', label: 'Votes', hint: 'Fin de vote proche, cadeau choisi.' },
  { key: 'tasks', label: 'Missions', hint: 'Quand une mission t’est confiée.' },
  { key: 'capsule', label: 'Capsule', hint: 'Ouverture de la capsule, remerciements.' },
  { key: 'messages', label: 'Discussion', hint: 'Nouveaux messages (désactivé par défaut).' },
  { key: 'emails', label: 'Aussi par e-mail', hint: 'L’ouverture de la capsule t’est aussi annoncée par e-mail. Facultatif, jamais de publicité. Les codes de connexion sont toujours envoyés.' },
];

export default function ProfileScreen() {
  const { session } = useAuth();
  const profile = useProfile();
  const prefs = usePrefs();
  const updatePrefs = useUpdatePrefs();
  const [editing, setEditing] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const p = profile.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Profil" meta="Ce que voient tes amis, et ce que tu reçois." />
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <AvatarEditor />
          <T v="h2" style={{ textAlign: 'center' }}>
            {p?.display_name ?? ' '}
          </T>
          <T color={colors.inkSoft}>{p ? `@${p.username}` : ' '}</T>
          <Button compact variant="outline" label="Modifier le profil" onPress={() => setEditing(true)} />
        </View>

        <SectionHeader title="Notifications" />
        <Group>
          {PREFS.map((pref, i) => (
            <View key={pref.key}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between', paddingVertical: space.md }}>
                <View style={{ flex: 1 }}>
                  <T v="bodyBold">{pref.label}</T>
                  <T v="small" color={colors.inkSoft}>
                    {pref.hint}
                  </T>
                </View>
                <Toggle
                  value={prefs.data?.[pref.key] ?? false}
                  disabled={!prefs.data}
                  onValueChange={(v) => updatePrefs.mutate({ [pref.key]: v })}
                  label={`Notifications : ${pref.label}`}
                />
              </Row>
            </View>
          ))}
        </Group>
        <T v="small" color={colors.inkSoft}>
          Les alertes s’affichent dans l’onglet Activité ; une même alerte n’est jamais envoyée deux fois. Les notifications push sur le téléphone ne sont pas encore actives.
        </T>

        <SectionHeader title="Confidentialité" />
        <Group>
          <ListRow title="Personnes bloquées" subtitle="Elles ne peuvent ni te trouver, ni t’ajouter, ni t’inviter." left={<Ban size={22} color={colors.ink} />} onPress={() => setBlockedOpen(true)} chevron />
          <Divider />
          <ListRow title="Tes données" subtitle="Ce qui est conservé, qui le voit, tes droits." left={<ShieldCheck size={22} color={colors.ink} strokeWidth={1.75} />} onPress={() => router.push('/privacy')} chevron />
          <Divider />
          <ExportData />
        </Group>

        <Group>
          <ListRow
            title="Se déconnecter"
            subtitle="Les brouillons enregistrés sur ce téléphone sont effacés."
            left={<LogOut size={22} color={colors.ink} />}
            onPress={() => void signOutEverywhere()}
          />
        </Group>
        <DeleteAccount />
        <T v="small" color={colors.inkFaint} style={{ textAlign: 'center' }}>
          Connecté·e avec {session?.user.email}
        </T>
      </ScrollView>
      <EditProfileSheet visible={editing} onClose={() => setEditing(false)} />
      <BlockedSheet visible={blockedOpen} onClose={() => setBlockedOpen(false)} />
    </SafeAreaView>
  );
}

function AvatarEditor() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const { session } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const p = profile.data;

  async function choose() {
    setMenu(false);
    try {
      const img = await pickImage([1, 1]);
      if (!img || !session) return;
      setPreview(img.uri);
      setBusy(true);
      const old = p?.avatar_path;
      const path = await uploadImage('avatars', session.user.id, img);
      await update.mutateAsync({ avatar_path: path });
      if (old) void supabase.storage.from('avatars').remove([old]);
      hapticSuccess();
      toast.show({ text: 'Photo mise à jour', tone: 'success' });
    } catch (e) {
      setPreview(null);
      toast.show({ text: e instanceof Error && !/^[a-z_]+$/.test(e.message) ? e.message : messageFor(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setMenu(false);
    const old = p?.avatar_path;
    if (!old) return;
    try {
      await update.mutateAsync({ avatar_path: null });
      setPreview(null);
      void supabase.storage.from('avatars').remove([old]);
      toast.show({ text: 'Photo retirée', tone: 'info' });
    } catch (e) {
      toast.show({ text: messageFor(e), tone: 'error' });
    }
  }

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={p?.avatar_path ? 'Changer ma photo de profil' : 'Ajouter une photo de profil'} onPress={() => (p?.avatar_path ? setMenu(true) : choose())}>
        <UserAvatar name={p?.display_name ?? '?'} path={p?.avatar_path} seed={p?.id} localUri={preview} size={112} />
        <View style={{ position: 'absolute', right: 0, bottom: 0, width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Camera size={18} color={colors.white} />}
        </View>
      </Pressable>
      <Sheet visible={menu} onClose={() => setMenu(false)} title="Photo de profil" subtitle="Visible de tes amis et des membres de tes cagnottes.">
        <Group>
          <ListRow title="Choisir une nouvelle photo" left={<Camera size={22} color={colors.ink} />} onPress={choose} />
          <Divider />
          <ListRow title="Retirer la photo" left={<Trash2 size={22} color={colors.danger} />} onPress={removePhoto} />
        </Group>
      </Sheet>
    </>
  );
}

function EditProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const profile = useProfile();
  const update = useUpdateProfile();
  const setUsername = useSetUsername();
  const toast = useToast();
  const p = profile.data;
  const [name, setName] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const nameValue = name ?? p?.display_name ?? '';
  const userValue = user ?? p?.username ?? '';
  const normalized = normalizeQuery(userValue);
  const available = useUsernameAvailable(userValue, p?.username);
  const userChanged = normalized !== p?.username;
  const userFormatOk = USERNAME_RE.test(normalized);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setName(null);
    setUser(null);
    setError(null);
    onClose();
  };

  async function save() {
    setError(null);
    const n = nameValue.trim();
    if (n.length < 1 || n.length > 40) return setError('Prénom ou pseudo affiché : 1 à 40 caractères.');
    if (userChanged && !userFormatOk) return setError(messageFor('invalid_username'));
    try {
      if (n !== p?.display_name) await update.mutateAsync({ display_name: n });
      if (userChanged) await setUsername.mutateAsync(normalized);
      hapticSuccess();
      toast.show({ text: 'Profil mis à jour', tone: 'success' });
      close();
    } catch (e) {
      setError(messageFor(e));
    }
  }

  const status = !userChanged
    ? 'C’est ton pseudo actuel.'
    : !userFormatOk
      ? '3 à 20 caractères : lettres minuscules, chiffres, point, tiret bas.'
      : available.isFetching
        ? 'Vérification…'
        : available.data === false
          ? 'Déjà pris.'
          : available.data
            ? 'Disponible !'
            : ' ';

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title="Modifier le profil"
      footer={<Button label="Enregistrer" onPress={save} loading={update.isPending || setUsername.isPending} disabled={userChanged && (available.data === false || !userFormatOk)} />}
    >
      <Field label="Prénom affiché" value={nameValue} onChangeText={setName} maxLength={40} autoComplete="given-name" icon={<User size={20} color={colors.inkSoft} strokeWidth={1.75} />} hint="C’est le nom que voient tes groupes." />
      <View style={{ gap: 6 }}>
        <Field
          label="Pseudo"
          value={userValue}
          onChangeText={(v) => setUser(v.toLowerCase().replace(/\s/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={21}
          icon={<AtSign size={20} color={colors.inkSoft} strokeWidth={1.75} />}
          right={userChanged && available.data && userFormatOk ? <Check size={20} color={colors.success} strokeWidth={2.5} /> : null}
        />
        <T v="small" color={userChanged && (available.data === false || !userFormatOk) ? colors.danger : userChanged && available.data ? colors.success : colors.inkSoft} accessibilityLiveRegion="polite">
          {status}
        </T>
        <T v="small" color={colors.inkSoft}>
          Tes amis te trouvent avec ce pseudo. Ton e-mail n’est jamais affiché.
        </T>
      </View>
      {error ? <Banner tone="error">{error}</Banner> : null}
    </Sheet>
  );
}

function BlockedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const blocked = useBlocked(visible);
  const unblock = useUnblockUser();
  const toast = useToast();
  return (
    <Sheet visible={visible} onClose={onClose} title="Personnes bloquées" subtitle="Débloquer ne rétablit pas l’amitié : il faudra une nouvelle demande.">
      {blocked.isPending ? (
        <ActivityIndicator color={colors.coral} />
      ) : (blocked.data ?? []).length === 0 ? (
        <T color={colors.inkSoft}>Tu n’as bloqué personne.</T>
      ) : (
        <Group>
          {blocked.data!.map((b, i) => (
            <View key={b.user_id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={b.display_name}
                subtitle={`@${b.username}`}
                left={<UserAvatar name={b.display_name} seed={b.user_id} size={40} ring={null} />}
                right={
                  <Button
                    compact
                    variant="ghost"
                    label="Débloquer"
                    onPress={() => unblock.mutate(b.user_id, { onSuccess: () => toast.show({ text: `${b.display_name} est débloqué·e`, tone: 'info' }), onError: (e) => toast.show({ text: messageFor(e), tone: 'error' }) })}
                  />
                }
              />
            </View>
          ))}
        </Group>
      )}
    </Sheet>
  );
}

/** Export des données du compte (RPC export_my_data) : uniquement mes données, jamais celles des autres. */
function ExportData() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('export_my_data');
      if (error) throw error;
      const json = JSON.stringify(data, null, 2);
      const name = `complice-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: name, message: json });
      }
      hapticSuccess();
    } catch (e) {
      toast.show({ text: messageFor(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <ListRow
      title={busy ? 'Préparation…' : 'Exporter mes données'}
      subtitle="Un fichier avec ton profil, tes contenus et tes participations."
      left={<Download size={22} color={colors.ink} />}
      onPress={run}
    />
  );
}

function DeleteAccount() {
  const [msg, setMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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
      setMsg(
        code === 'api_not_configured'
          ? 'La suppression passe par le serveur, qui n’est pas encore configuré (EXPO_PUBLIC_API_URL).'
          : code === 'server_not_configured'
            ? 'Le serveur n’a pas encore sa clé d’administration : suppression impossible pour le moment.'
            : messageFor(e),
      );
    }
  }
  return (
    <View style={{ gap: space.sm, padding: space.lg, borderRadius: 24, borderWidth: 1, borderColor: colors.dangerSoft, backgroundColor: colors.surface }}>
      <T v="h3" color={colors.danger}>
        Supprimer mon compte
      </T>
      <T v="small" color={colors.inkSoft}>
        Action définitive et immédiate : profil, photo, amis, mots, photos et brouillons sont effacés ; tu perds l’accès à tes groupes. Tes messages et tes idées restent visibles du groupe, sans ton nom ; tes participations restent comptées dans les cagnottes, sans ton nom.
        {!isApiConfigured ? ' Nécessite le serveur COMPLICE (non configuré dans cette version).' : ''}
      </T>
      {msg ? <Banner tone="error">{msg}</Banner> : null}
      <ConfirmButton label="Supprimer mon compte" confirmLabel="Confirmer : supprimer définitivement" loading={deleting} onConfirm={deleteAccount} />
    </View>
  );
}
