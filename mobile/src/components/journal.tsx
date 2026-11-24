import { Check, Gift, HandCoins, Lightbulb, ListChecks, Stamp, UserRoundPlus, UsersRound, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { timeAgo } from '@/lib/format';
import { buildJournal, type JournalEntry, type JournalFamily } from '@/lib/journal';
import type { ActivityRow } from '@/lib/types';
import { colors, fonts, space, tints, type Tint } from '@/theme/tokens';
import { Sheet } from './kit';
import { T, TextLink } from './ui';

/**
 * Journal d'une cagnotte : un repère par type d'action (même famille d'icônes que l'activité),
 * l'action d'abord, la date en second. Les participations n'ont ni nom ni avatar.
 */
const LOOK: Record<JournalFamily, { Icon: LucideIcon; tint: Tint }> = {
  group: { Icon: UserRoundPlus, tint: 'group' },
  idea: { Icon: Lightbulb, tint: 'sun' },
  gift: { Icon: Gift, tint: 'sun' },
  money: { Icon: HandCoins, tint: 'money' },
  task: { Icon: ListChecks, tint: 'group' },
  done: { Icon: Check, tint: 'done' },
  stamp: { Icon: Stamp, tint: 'sun' },
  role: { Icon: UsersRound, tint: 'group' },
};

const PREVIEW = 4;

export function Journal({ rows }: { rows: ActivityRow[] }) {
  const [all, setAll] = useState(false);
  const entries = buildJournal(rows);
  if (entries.length === 0) {
    return (
      <T v="small" color={colors.inkSoft}>
        Le journal se remplira au fil des idées, des votes et des missions.
      </T>
    );
  }
  return (
    <View>
      {entries.slice(0, PREVIEW).map((e, i) => (
        <JournalLine key={e.key} entry={e} last={i === Math.min(PREVIEW, entries.length) - 1} />
      ))}
      {entries.length > PREVIEW ? <TextLink label={`Tout l’historique (${entries.length})`} onPress={() => setAll(true)} /> : null}
      <Sheet visible={all} onClose={() => setAll(false)} title="Historique">
        <View>
          {entries.map((e, i) => (
            <JournalLine key={e.key} entry={e} last={i === entries.length - 1} />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

function JournalLine({ entry: e, last }: { entry: JournalEntry; last: boolean }) {
  const look = LOOK[e.family];
  const tint = tints[look.tint];
  return (
    <View accessible accessibilityLabel={`${e.text} ${timeAgo(e.at)}`} style={{ flexDirection: 'row', gap: space.md }}>
      {/* Colonne des repères, reliés par un filet : le rythme du journal */}
      <View style={{ alignItems: 'center', width: 32 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
          <look.Icon size={17} color={tint.fg} strokeWidth={2.1} />
        </View>
        {!last ? <View style={{ flex: 1, width: 1.5, backgroundColor: colors.border, marginVertical: 3 }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingTop: 5, paddingBottom: last ? 0 : space.lg, gap: 1 }}>
        <T v="body" style={{ fontSize: 15, lineHeight: 21 }}>
          {e.text}
        </T>
        <T v="small" color={colors.inkFaint} style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 }}>
          {timeAgo(e.at)}
        </T>
      </View>
    </View>
  );
}
