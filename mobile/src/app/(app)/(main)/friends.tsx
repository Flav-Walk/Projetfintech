import { messageFor, type FriendRow, type ProfileSearchRow } from '@complice/shared';
import * as Clipboard from 'expo-clipboard';
import { AtSign, Ban, Check, Search, Share2, UserMinus, UserPlus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserAvatar } from '@/components/avatar';
import { Divider, Group, ListRow, PageHeader, Segmented, Sheet, SkeletonList, SwipeRow } from '@/components/kit';
import { Mascot } from '@/components/mascot';
import { ErrorState } from '@/components/states';
import { Button, T } from '@/components/ui';
import { hapticSuccess } from '@/lib/haptics';
import { useProfile } from '@/lib/queries';
import {
  normalizeQuery,
  useBlockUser,
  useCancelFriendRequest,
  useFriends,
  useProfileSearch,
  useRemoveFriend,
  useRespondFriendRequest,
  useSendFriendRequest,
} from '@/lib/social';
import { useToast } from '@/lib/toast';
import { colors, fonts, gutter, radius, space } from '@/theme/tokens';

type Tab = 'friends' | 'requests';

export default function Friends() {
  const profile = useProfile();
  const friends = useFriends();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('friends');
  const [manage, setManage] = useState<FriendRow | null>(null);
  const search = useProfileSearch(query);
  const toast = useToast();
  const searching = normalizeQuery(query).length > 0;

  const { list, incoming, outgoing } = useMemo(() => {
    const all = friends.data ?? [];
    return {
      list: all.filter((f) => f.relation === 'friend'),
      incoming: all.filter((f) => f.relation === 'incoming'),
      outgoing: all.filter((f) => f.relation === 'outgoing'),
    };
  }, [friends.data]);

  const me = profile.data?.username;
  async function shareMe() {
    if (!me) return;
    await Share.share({ message: `Ajoute-moi sur COMPLICE pour préparer nos cadeaux communs : @${me}` });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={friends.isRefetching} onRefresh={() => void friends.refetch()} tintColor={colors.coral} />}
      >
        <PageHeader
          title="Amis"
          subtitle={me ? `Ton pseudo : @${me}` : undefined}
          right={
            me ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Partager mon pseudo @${me}`}
                onPress={shareMe}
                onLongPress={async () => {
                  await Clipboard.setStringAsync(`@${me}`);
                  hapticSuccess();
                  toast.show({ text: 'Pseudo copié', tone: 'success' });
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: radius.pill, backgroundColor: colors.lavender }}
              >
                <Share2 size={16} color={colors.violetDark} strokeWidth={2.25} />
                <T v="label" color={colors.violetDark}>
                  Mon pseudo
                </T>
              </Pressable>
            ) : null
          }
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.field, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: space.md, minHeight: 52 }}>
          <Search size={20} color={colors.inkSoft} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un pseudo"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Rechercher une personne par son pseudo"
            style={{ flex: 1, fontFamily: fonts.semiBold, fontSize: 16, color: colors.ink, paddingVertical: 12 }}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche" hitSlop={10} onPress={() => setQuery('')}>
              <X size={20} color={colors.inkSoft} />
            </Pressable>
          ) : null}
        </View>

        {searching ? (
          <SearchResults query={query} results={search.data} loading={search.isFetching} error={search.error} />
        ) : (
          <>
            <Segmented
              label="Amis et demandes"
              value={tab}
              onChange={setTab}
              options={[
                { key: 'friends', label: 'Mes amis', count: list.length || undefined },
                { key: 'requests', label: 'Demandes', count: incoming.length || undefined },
              ]}
            />
            {friends.isPending ? (
              <SkeletonList rows={4} />
            ) : friends.isError ? (
              <ErrorState error={friends.error} onRetry={() => friends.refetch()} />
            ) : tab === 'friends' ? (
              list.length === 0 ? (
                <Empty
                  title="Ajoute tes proches"
                  text="Cherche leur pseudo ci-dessus ou partage le tien. Entre amis, inviter dans une cagnotte se fait en deux touches."
                  action={<Button label="Partager mon pseudo" variant="secondary" icon={<AtSign size={18} color={colors.white} />} onPress={shareMe} />}
                />
              ) : (
                <Group style={{ paddingHorizontal: 0 }}>
                  {list.map((f, i) => (
                    <Animated.View key={f.user_id} entering={FadeIn.duration(180)} layout={LinearTransition.duration(180)}>
                      {i > 0 ? <View style={{ marginLeft: 72 }}><Divider /></View> : null}
                      <FriendLine friend={f} onManage={() => setManage(f)} />
                    </Animated.View>
                  ))}
                </Group>
              )
            ) : (
              <Requests incoming={incoming} outgoing={outgoing} />
            )}
            <T v="small" color={colors.inkSoft} style={{ textAlign: 'center' }}>
              Être amis ne donne accès à aucune cagnotte : chacun choisit de rejoindre les groupes auxquels il est invité.
            </T>
          </>
        )}
      </ScrollView>
      <ManageSheet friend={manage} onClose={() => setManage(null)} />
    </SafeAreaView>
  );
}

function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
      <Mascot size={92} mood="wink" />
      <T v="h3" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T color={colors.inkSoft} style={{ textAlign: 'center', maxWidth: 320 }}>
        {text}
      </T>
      {action}
    </View>
  );
}

function FriendLine({ friend, onManage }: { friend: FriendRow; onManage: () => void }) {
  const remove = useRemoveFriend();
  const block = useBlockUser();
  const toast = useToast();
  return (
    <SwipeRow
      actions={[
        {
          label: 'Retirer',
          color: colors.inkSoft,
          icon: <UserMinus size={20} color={colors.white} />,
          onPress: () =>
            remove.mutate(friend.user_id, {
              onSuccess: () => toast.show({ text: `${friend.display_name} n’est plus dans tes amis`, tone: 'info' }),
              onError: (e) => toast.show({ text: messageFor(e), tone: 'error' }),
            }),
        },
        {
          label: 'Bloquer',
          color: colors.danger,
          icon: <Ban size={20} color={colors.white} />,
          onPress: () =>
            block.mutate(friend.user_id, {
              onSuccess: () => toast.show({ text: `${friend.display_name} est bloqué·e`, tone: 'info' }),
              onError: (e) => toast.show({ text: messageFor(e), tone: 'error' }),
            }),
        },
      ]}
    >
      <ListRow
        style={{ paddingHorizontal: space.lg }}
        title={friend.display_name}
        subtitle={`@${friend.username}`}
        left={<UserAvatar name={friend.display_name} path={friend.avatar_path} seed={friend.user_id} size={44} ring={null} />}
        onPress={onManage}
        accessibilityLabel={`${friend.display_name}, @${friend.username}. Options`}
        chevron
      />
    </SwipeRow>
  );
}

function Requests({ incoming, outgoing }: { incoming: FriendRow[]; outgoing: FriendRow[] }) {
  const respond = useRespondFriendRequest();
  const cancel = useCancelFriendRequest();
  const toast = useToast();
  if (incoming.length === 0 && outgoing.length === 0) {
    return <Empty title="Aucune demande en attente" text="Les demandes reçues et envoyées s’afficheront ici." />;
  }
  return (
    <View style={{ gap: space.lg }}>
      {incoming.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <T v="overline" color={colors.inkSoft}>
            Reçues
          </T>
          <Group style={{ paddingHorizontal: space.lg }}>
            {incoming.map((f, i) => (
              <View key={f.user_id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={f.display_name}
                  subtitle={`@${f.username} veut t’ajouter`}
                  left={<UserAvatar name={f.display_name} path={f.avatar_path} seed={f.user_id} size={44} ring={null} />}
                  right={
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <RoundAction
                        label={`Refuser la demande de ${f.display_name}`}
                        onPress={() => respond.mutate({ id: f.user_id, accept: false }, { onError: (e) => toast.show({ text: messageFor(e), tone: 'error' }) })}
                      >
                        <X size={20} color={colors.ink} />
                      </RoundAction>
                      <RoundAction
                        primary
                        label={`Accepter la demande de ${f.display_name}`}
                        onPress={() =>
                          respond.mutate(
                            { id: f.user_id, accept: true },
                            {
                              onSuccess: () => {
                                hapticSuccess();
                                toast.show({ text: `Vous êtes amis, ${f.display_name} et toi`, tone: 'success' });
                              },
                              onError: (e) => toast.show({ text: messageFor(e), tone: 'error' }),
                            },
                          )
                        }
                      >
                        <Check size={20} color={colors.white} strokeWidth={2.75} />
                      </RoundAction>
                    </View>
                  }
                />
              </View>
            ))}
          </Group>
        </View>
      ) : null}
      {outgoing.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <T v="overline" color={colors.inkSoft}>
            Envoyées
          </T>
          <Group style={{ paddingHorizontal: space.lg }}>
            {outgoing.map((f, i) => (
              <View key={f.user_id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={f.display_name}
                  subtitle={`@${f.username} · en attente`}
                  left={<UserAvatar name={f.display_name} path={f.avatar_path} seed={f.user_id} size={44} ring={null} />}
                  right={
                    <Button
                      compact
                      variant="ghost"
                      label="Annuler"
                      onPress={() =>
                        cancel.mutate(f.user_id, {
                          onSuccess: () => toast.show({ text: 'Demande annulée', tone: 'info' }),
                          onError: (e) => toast.show({ text: messageFor(e), tone: 'error' }),
                        })
                      }
                    />
                  }
                />
              </View>
            ))}
          </Group>
        </View>
      ) : null}
    </View>
  );
}

function RoundAction({ children, onPress, label, primary = false }: { children: React.ReactNode; onPress: () => void; label: string; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? (pressed ? colors.violetDark : colors.violet) : pressed ? colors.sand : colors.surfaceSoft })}
    >
      {children}
    </Pressable>
  );
}

function SearchResults({ query, results, loading, error }: { query: string; results?: ProfileSearchRow[]; loading: boolean; error: unknown }) {
  const send = useSendFriendRequest();
  const respond = useRespondFriendRequest();
  const cancel = useCancelFriendRequest();
  const toast = useToast();
  const q = normalizeQuery(query);
  if (q.length < 2) return <T color={colors.inkSoft}>Tape au moins 2 caractères du pseudo.</T>;
  if (!/^[a-z0-9_.]+$/.test(q)) return <T color={colors.inkSoft}>Un pseudo ne contient que des lettres, chiffres, points et tirets bas.</T>;
  if (error) return <ErrorState error={error} />;
  if (!results) return loading ? <SkeletonList rows={2} /> : null;
  if (results.length === 0) return <Empty title="Personne avec ce pseudo" text="Vérifie l’orthographe, ou demande-lui son pseudo (Profil > Mon pseudo)." />;
  return (
    <Group style={{ paddingHorizontal: space.lg }}>
      {results.map((r, i) => {
        const action =
          r.relation === 'friend' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Check size={16} color={colors.success} strokeWidth={2.5} />
              <T v="label" color={colors.success}>
                Ami
              </T>
            </View>
          ) : r.relation === 'outgoing' ? (
            <Button compact variant="ghost" label="Demandé" onPress={() => cancel.mutate(r.user_id, { onSuccess: () => toast.show({ text: 'Demande annulée', tone: 'info' }) })} accessibilityHint="Annule la demande envoyée" />
          ) : r.relation === 'incoming' ? (
            <Button compact variant="secondary" label="Accepter" onPress={() => respond.mutate({ id: r.user_id, accept: true }, { onSuccess: () => (hapticSuccess(), toast.show({ text: 'Vous êtes amis', tone: 'success' })) })} />
          ) : (
            <Button
              compact
              variant="secondary"
              label="Ajouter"
              icon={<UserPlus size={16} color={colors.white} />}
              loading={send.isPending && send.variables === r.user_id}
              onPress={() =>
                send.mutate(r.user_id, {
                  onSuccess: (res) => {
                    hapticSuccess();
                    toast.show({ text: res.status === 'accepted' ? `Vous êtes amis, ${r.display_name} et toi` : 'Demande envoyée', tone: 'success' });
                  },
                  onError: (e) => toast.show({ text: messageFor(e), tone: 'error' }),
                })
              }
            />
          );
        return (
          <View key={r.user_id}>
            {i > 0 ? <Divider /> : null}
            <ListRow title={r.display_name} subtitle={`@${r.username}`} left={<UserAvatar name={r.display_name} path={r.avatar_path} seed={r.user_id} size={44} ring={null} />} right={action} />
          </View>
        );
      })}
    </Group>
  );
}

function ManageSheet({ friend, onClose }: { friend: FriendRow | null; onClose: () => void }) {
  const remove = useRemoveFriend();
  const block = useBlockUser();
  const toast = useToast();
  const [confirm, setConfirm] = useState<'remove' | 'block' | null>(null);
  const close = () => {
    setConfirm(null);
    onClose();
  };
  return (
    <Sheet visible={!!friend} onClose={close} title={friend?.display_name ?? ''} subtitle={friend ? `@${friend.username}` : undefined}>
      {friend ? (
        <View style={{ gap: space.md }}>
          <View style={{ alignItems: 'center' }}>
            <UserAvatar name={friend.display_name} path={friend.avatar_path} seed={friend.user_id} size={88} />
          </View>
          {confirm === 'block' ? (
            <View style={{ gap: space.md }}>
              <T color={colors.inkSoft}>
                {friend.display_name} ne pourra plus t’envoyer de demande ni t’inviter, et ne te trouvera plus en recherche. Vos cagnottes communes continuent normalement. Tu pourras débloquer depuis ton profil.
              </T>
              <Button
                variant="danger"
                label={`Bloquer ${friend.display_name}`}
                loading={block.isPending}
                onPress={() =>
                  block.mutate(friend.user_id, {
                    onSuccess: () => {
                      toast.show({ text: `${friend.display_name} est bloqué·e`, tone: 'info' });
                      close();
                    },
                    onError: (e) => toast.show({ text: messageFor(e), tone: 'error' }),
                  })
                }
              />
            </View>
          ) : confirm === 'remove' ? (
            <View style={{ gap: space.md }}>
              <T color={colors.inkSoft}>Vos cagnottes communes ne changent pas. Vous pourrez vous ajouter à nouveau plus tard.</T>
              <Button
                variant="outline"
                label="Retirer de mes amis"
                loading={remove.isPending}
                onPress={() =>
                  remove.mutate(friend.user_id, {
                    onSuccess: () => {
                      toast.show({ text: `${friend.display_name} n’est plus dans tes amis`, tone: 'info' });
                      close();
                    },
                    onError: (e) => toast.show({ text: messageFor(e), tone: 'error' }),
                  })
                }
              />
            </View>
          ) : (
            <Group>
              <ListRow title="Retirer de mes amis" left={<UserMinus size={22} color={colors.ink} />} onPress={() => setConfirm('remove')} chevron />
              <Divider />
              <ListRow title="Bloquer" subtitle="Plus de demandes ni d’invitations" left={<Ban size={22} color={colors.danger} />} onPress={() => setConfirm('block')} chevron />
            </Group>
          )}
        </View>
      ) : null}
    </Sheet>
  );
}
