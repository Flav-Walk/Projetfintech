import { CircleAlert, Lock, SendHorizontal } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/event-parts';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { Button, Row, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { flattenMessages, useMessages, useOutbox, type Outgoing } from '@/lib/chat';
import { formatEventDate } from '@/lib/format';
import { useEvent, useProgress } from '@/lib/queries';
import type { MessageRow } from '@/lib/types';
import { useEventId } from '@/lib/use-event-context';
import { colors, fonts, gutter, radius, space } from '@/theme/tokens';

type Item = { kind: 'server'; m: MessageRow } | { kind: 'local'; o: Outgoing };

export default function Chat() {
  const id = useEventId();
  const { session } = useAuth();
  const me = session?.user.id;
  const event = useEvent(id);
  const progress = useProgress(id);
  const isPreparer = !!progress.data && progress.data.my_role !== 'beneficiary';
  const messages = useMessages(id);
  const outbox = useOutbox(id);
  const [draft, setDraft] = useState('');

  const items = useMemo<Item[]>(() => {
    const server = flattenMessages(messages.data);
    const known = new Set(server.map((m) => m.client_id).filter(Boolean));
    const pending = outbox.items.filter((o) => !known.has(o.client_id)).reverse();
    return [...pending.map((o) => ({ kind: 'local' as const, o })), ...server.map((m) => ({ kind: 'server' as const, m }))];
  }, [messages.data, outbox.items]);

  if (progress.isPending || event.isPending) return <Loading />;
  if (!isPreparer) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <EmptyState title="Discussion privée" text="Ton groupe discute ici en secret pour te préparer une surprise." />
      </SafeAreaView>
    );
  }

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    outbox.send(body);
    setDraft('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: space.sm, gap: 4 }}>
        <T v="h1" accessibilityRole="header">
          Discussion
        </T>
        <Row gap={6}>
          <Lock size={14} color={colors.inkSoft} />
          <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>
            Privée : {event.data?.beneficiary_name ?? 'la personne fêtée'} n’y a jamais accès.
          </T>
        </Row>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {messages.isPending ? (
          <Loading />
        ) : messages.isError ? (
          <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
        ) : (
          <FlatList
            inverted={items.length > 0}
            data={items}
            keyExtractor={(it) => (it.kind === 'server' ? it.m.id : `local-${it.o.client_id}`)}
            contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: space.md, gap: space.sm, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            onEndReached={() => {
              if (messages.hasNextPage && !messages.isFetchingNextPage) void messages.fetchNextPage();
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={messages.isFetchingNextPage ? <ActivityIndicator color={colors.coral} style={{ margin: space.md }} /> : undefined}
            ListEmptyComponent={<EmptyState title="Lance la conversation" text="Qui s’occupe de quoi ? Une idée de dernière minute ? C’est ici." />}
            renderItem={({ item }) =>
              item.kind === 'server' ? (
                <Bubble mine={item.m.author_id === me} author={item.m.profiles?.display_name ?? 'Ancien membre'} body={item.m.body} meta={formatEventDate(item.m.created_at, event.data?.timezone)} />
              ) : (
                <Bubble
                  mine
                  author="Moi"
                  body={item.o.body}
                  meta={item.o.status === 'sending' ? 'Envoi…' : 'Non envoyé'}
                  failed={item.o.status === 'failed'}
                  onRetry={() => void outbox.retry(item.o)}
                />
              )
            }
          />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: gutter, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Écrire au groupe…"
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel="Message"
            multiline
            maxLength={1000}
            style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radius.field, backgroundColor: colors.bg, paddingHorizontal: space.md, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.semiBold, fontSize: 16, color: colors.ink }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            accessibilityState={{ disabled: !draft.trim() }}
            disabled={!draft.trim()}
            onPress={submit}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: draft.trim() ? colors.violet : colors.lavenderStrong, alignItems: 'center', justifyContent: 'center' }}
          >
            <SendHorizontal size={22} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ mine, author, body, meta, failed, onRetry }: { mine: boolean; author: string; body: string; meta: string; failed?: boolean; onRetry?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', gap: space.sm, alignItems: 'flex-end' }}>
      {!mine ? <Avatar name={author} size={30} /> : null}
      <View style={{ maxWidth: '78%', gap: 2, alignItems: mine ? 'flex-end' : 'flex-start' }}>
        {!mine ? (
          <T v="small" color={colors.inkSoft} style={{ fontFamily: fonts.bold }}>
            {author}
          </T>
        ) : null}
        <View
          style={{
            backgroundColor: mine ? colors.violet : colors.surface,
            borderWidth: mine ? 0 : 1,
            borderColor: colors.border,
            borderRadius: 18,
            borderBottomRightRadius: mine ? 6 : 18,
            borderBottomLeftRadius: mine ? 18 : 6,
            paddingHorizontal: space.md,
            paddingVertical: 10,
            opacity: failed ? 0.7 : 1,
          }}
        >
          <T color={mine ? colors.white : colors.ink}>{body}</T>
        </View>
        {failed ? (
          <Row gap={6}>
            <CircleAlert size={14} color={colors.danger} />
            <T v="small" color={colors.danger}>
              Non envoyé
            </T>
            <Button compact variant="ghost" label="Réessayer" onPress={onRetry} />
          </Row>
        ) : (
          <T v="small" color={colors.inkSoft} style={{ fontSize: 11 }}>
            {meta}
          </T>
        )}
      </View>
    </View>
  );
}
