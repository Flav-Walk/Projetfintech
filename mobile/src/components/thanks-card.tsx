import { messageFor } from '@complice/shared';
import { HeartHandshake } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSaveThanks } from '@/lib/capsule';
import type { ThanksRow } from '@/lib/types';
import { colors, radius, space, type } from '@/theme/tokens';
import { Banner, Button, Row, T } from './ui';

/** Remerciements : le bénéficiaire écrit un message au groupe ; le groupe le lit dans le souvenir. */
export function ThanksCard({ eventId, beneficiaryName, canWrite, thanks, loading }: { eventId: string; beneficiaryName: string; canWrite: boolean; thanks: ThanksRow | null; loading: boolean }) {
  const save = useSaveThanks(eventId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  if (loading) return null;
  if (!canWrite) {
    if (!thanks) return null;
    return (
      <View style={{ backgroundColor: colors.sunSoft, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
        <Row gap={space.sm}>
          <HeartHandshake size={22} color={colors.coralDark} strokeWidth={1.75} />
          <T v="label">Le mot de {beneficiaryName} pour le groupe</T>
        </Row>
        <T v="hand">{thanks.body}</T>
      </View>
    );
  }
  if (thanks && !editing) {
    return (
      <View style={{ backgroundColor: colors.sunSoft, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
        <T v="label">Ton merci au groupe</T>
        <T v="hand">{thanks.body}</T>
        {sent ? <T v="small" color={colors.success}>Envoyé : tout le groupe peut le lire.</T> : null}
        <Button compact variant="ghost" label="Modifier" onPress={() => (setText(thanks.body), setEditing(true), setSent(false))} />
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: radius.card, padding: space.lg, gap: space.md }}>
      <T v="h3">Un merci pour le groupe ?</T>
      <T v="small" color={colors.inkSoft}>
        Facultatif. Ton message apparaîtra dans ce souvenir pour toutes les personnes qui l’ont préparé.
      </T>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        placeholder="Merci à tous, c’est un super cadeau !"
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel="Ton message de remerciement"
        style={[type.body, { minHeight: 96, textAlignVertical: 'top', color: colors.ink, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: space.md }]}
      />
      {save.isError ? <Banner tone="error">{messageFor(save.error)}</Banner> : null}
      <Button
        variant="secondary"
        label="Envoyer mon merci"
        disabled={!text.trim()}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { body: text.trim(), exists: !!thanks },
            { onSuccess: () => (setEditing(false), setSent(true)) },
          )
        }
      />
    </View>
  );
}

