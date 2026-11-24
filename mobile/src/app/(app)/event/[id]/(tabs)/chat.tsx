import { ArrowUp, CircleAlert, RotateCw } from 'lucide-react-native';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarPile, UserAvatar } from '@/components/avatar';
import { EventTabHeader, HeaderMeta } from '@/components/headers';
import { Mascot } from '@/components/mascot';
import { ErrorState, Loading } from '@/components/states';
import { T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { flattenMessages, useMessages, useOutbox } from '@/lib/chat';
import { layoutChat, type ChatRow } from '@/lib/chat-layout';
import { hapticTap } from '@/lib/haptics';
import { useEvent, useMembers, useProgress } from '@/lib/queries';
import { useEventId } from '@/lib/use-event-context';
import { colors, fonts, gutter, radius, space } from '@/theme/tokens';

type Msg = {
  key: string;
  author: string | null;
  created_at: string;
  name: string;
  avatar: string | null;
  body: string;
  mine: boolean;
  status: 'sent' | 'sending' | 'failed';
  retry?: () => void;
};

const STARTERS = ['Qui s’occupe de la carte ?', 'Une idée de dernière minute…', 'On se retrouve quand pour l’achat ?'];

export default function Chat() {
  const id = useEventId();
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const event = useEvent(id);
  const progress = useProgress(id);
  const members = useMembers(id);
  const isPreparer = !!progress.data && progress.data.my_role !== 'beneficiary';
  const messages = useMessages(id);
  const outbox = useOutbox(id);
  const [draft, setDraft] = useState('');
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const tz = event.data?.timezone ?? 'Europe/Paris';

  const rows = useMemo(() => {
    const server = flattenMessages(messages.data);
    const known = new Set(server.map((m) => m.client_id).filter(Boolean));
    const pending: Msg[] = outbox.items
      .filter((o) => !known.has(o.client_id))
      .reverse()
      .map((o) => ({ key: `local-${o.client_id}`, author: me, created_at: o.created_at, name: 'Moi', avatar: null, body: o.body, mine: true, status: o.status, retry: () => void outbox.retry(o) }));
    const sent: Msg[] = server.map((m) => ({
      key: m.id,
      author: m.author_id,
      created_at: m.created_at,
      name: m.profiles?.display_name ?? 'Ancien membre',
      avatar: m.profiles?.avatar_path ?? null,
      body: m.body,
      mine: m.author_id === me,
      status: 'sent' as const,
    }));
    return layoutChat([...pending, ...sent], tz);
  }, [messages.data, outbox, me, tz]);

  const renderItem = useCallback(({ item }: { item: ChatRow<Msg> }) => (item.kind === 'day' ? <DaySeparator label={item.label} /> : <Bubble row={item} tz={tz} />), [tz]);

  if (progress.isPending || event.isPending) return <Loading />;
  if (!isPreparer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: gutter, gap: space.md }}>
        <Mascot size={96} mood="wink" />
        <T v="h2" style={{ textAlign: 'center' }}>
          Chut…
        </T>
        <T color={colors.inkSoft} style={{ textAlign: 'center' }}>
          Ton groupe prépare quelque chose ici.
        </T>
      </SafeAreaView>
    );
  }

  const canSend = draft.trim().length > 0;
  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    hapticTap();
    outbox.send(body);
    setDraft('');
  };
  const preparers = (members.data ?? []).filter((m) => m.role !== 'beneficiary');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: gutter, paddingTop: space.sm, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {event.data ? (
          <EventTabHeader
            event={event.data}
            title="Discussion"
            meta={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <AvatarPile people={preparers.map((m) => ({ id: m.user_id, name: m.profiles?.display_name ?? '?', path: m.profiles?.avatar_path }))} max={4} size={24} />
                <HeaderMeta text={`${preparers.length} complice${preparers.length > 1 ? 's' : ''}`} />
              </View>
            }
          />
        ) : null}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {messages.isPending ? (
          <Loading />
        ) : messages.isError ? (
          <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
        ) : rows.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: gutter, paddingBottom: space.lg, gap: space.md }}>
            <Mascot size={64} mood="happy" />
            <T v="h2">Lance la conversation</T>
            <T color={colors.inkSoft}>Un mot pour s’organiser, une question, une idée de dernière minute.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {STARTERS.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`Commencer par : ${s}`}
                  onPress={() => {
                    setDraft(s);
                    input.current?.focus();
                  }}
                  style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: pressed ? colors.sandDeep : colors.surface, borderWidth: 1.5, borderColor: colors.border })}
                >
                  <T v="label" color={colors.ink}>
                    {s}
                  </T>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(r) => (r.kind === 'day' ? r.key : r.msg.key)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: space.md }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onEndReached={() => {
              if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={messages.isFetchingNextPage ? <ActivityIndicator color={colors.coral} style={{ margin: space.md }} /> : undefined}
          />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm, backgroundColor: colors.bg }}>
          <View style={{ flex: 1, minHeight: 46, borderRadius: 23, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: space.lg, justifyContent: 'center' }}>
            <TextInput
              ref={input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Écrire au groupe"
              placeholderTextColor={colors.inkFaint}
              accessibilityLabel="Message au groupe"
              multiline
              numberOfLines={1}
              maxLength={1000}
              style={{ maxHeight: 120, paddingTop: 11, paddingBottom: 11, fontFamily: fonts.semiBold, fontSize: 16, color: colors.ink }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Envoyer le message"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={submit}
            style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, backgroundColor: canSend ? (pressed ? colors.plum : colors.ink) : colors.sand, alignItems: 'center', justifyContent: 'center' })}
          >
            <ArrowUp size={22} color={canSend ? colors.white : colors.inkFaint} strokeWidth={2.5} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DaySeparator({ label }: { label: string }) {
  return (
    <View style={{ alignItems: 'center', marginVertical: space.md }}>
      <T v="small" color={colors.inkSoft} style={{ fontFamily: fonts.bold, backgroundColor: colors.sand, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' }}>
        {label}
      </T>
    </View>
  );
}

const time = (iso: string, tz: string) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso));

const Bubble = memo(function Bubble({ row, tz }: { row: Extract<ChatRow<Msg>, { kind: 'msg' }>; tz: string }) {
  const { msg: m, firstOfGroup, lastOfGroup } = row;
  const failed = m.status === 'failed';
  const r = 20;
  return (
    <View style={{ flexDirection: 'row', justifyContent: m.mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: space.sm, marginTop: firstOfGroup ? space.md : 3 }}>
      {!m.mine ? <View style={{ width: 30 }}>{lastOfGroup ? <UserAvatar name={m.name} path={m.avatar} seed={m.author ?? undefined} size={30} ring={null} /> : null}</View> : null}
      <View style={{ maxWidth: '78%', alignItems: m.mine ? 'flex-end' : 'flex-start', gap: 3 }}>
        {!m.mine && firstOfGroup ? (
          <T v="small" color={colors.inkSoft} style={{ fontFamily: fonts.bold, marginLeft: 4 }}>
            {m.name}
          </T>
        ) : null}
        <View
          style={{
            backgroundColor: m.mine ? colors.ink : colors.surface,
            borderWidth: m.mine ? 0 : 1,
            borderColor: colors.border,
            borderTopLeftRadius: !m.mine && !firstOfGroup ? 6 : r,
            borderBottomLeftRadius: !m.mine && !lastOfGroup ? 6 : r,
            borderTopRightRadius: m.mine && !firstOfGroup ? 6 : r,
            borderBottomRightRadius: m.mine && !lastOfGroup ? 6 : r,
            paddingHorizontal: 14,
            paddingVertical: 9,
            opacity: m.status === 'sending' ? 0.7 : 1,
          }}
        >
          <T color={m.mine ? colors.white : colors.ink} selectable>
            {m.body}
          </T>
        </View>
        {failed ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Message non envoyé. Réessayer" onPress={m.retry} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 }}>
            <CircleAlert size={14} color={colors.danger} />
            <T v="small" color={colors.danger} style={{ fontFamily: fonts.bold }}>
              Non envoyé · Réessayer
            </T>
            <RotateCw size={13} color={colors.danger} />
          </Pressable>
        ) : lastOfGroup ? (
          <T v="small" color={colors.inkFaint} style={{ fontSize: 11, lineHeight: 14, marginHorizontal: 4 }}>
            {m.status === 'sending' ? 'Envoi…' : time(m.created_at, tz)}
          </T>
        ) : null}
      </View>
    </View>
  );
});
