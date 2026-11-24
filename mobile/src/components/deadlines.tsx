import { Check } from 'lucide-react-native';
import { View } from 'react-native';
import { formatEventDate, timeUntil } from '@/lib/format';
import { useNow } from '@/lib/use-now';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { T } from './ui';

export type Deadline = { key: string; label: string; iso: string };

/** Regroupe les échéances au même instant (ex. remise du cadeau et ouverture de la capsule) et les trie. */
export function groupDeadlines(items: Deadline[]): { iso: string; labels: string[] }[] {
  const map = new Map<number, { iso: string; labels: string[] }>();
  for (const d of items) {
    const t = Math.round(new Date(d.iso).getTime() / 60000);
    const g = map.get(t) ?? { iso: d.iso, labels: [] };
    g.labels.push(d.label);
    map.set(t, g);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g);
}

const joinLabels = (l: string[]) => (l.length === 1 ? l[0]! : `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]!.charAt(0).toLowerCase()}${l[l.length - 1]!.slice(1)}`);

/**
 * Échéances : la prochaine en grand (délai d'abord), les autres en frise compacte.
 * Passées : cochées et estompées. Aucune colonne qui s'écrase : le délai passe sous le libellé.
 */
export function Deadlines({ items, timezone }: { items: Deadline[]; timezone: string }) {
  const now = useNow();
  const groups = groupDeadlines(items);
  const nextIndex = groups.findIndex((g) => new Date(g.iso).getTime() > now);
  const next = nextIndex >= 0 ? groups[nextIndex] : null;
  return (
    <View style={{ gap: space.lg }}>
      {next ? (
        <View accessible accessibilityLabel={`Prochaine échéance : ${joinLabels(next.labels)}, ${formatEventDate(next.iso, timezone)}, ${timeUntil(next.iso, now)}`} style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
          <View style={{ width: 64, borderRadius: radius.field, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center' }}>
            <View style={{ alignSelf: 'stretch', backgroundColor: colors.coral, paddingVertical: 3, alignItems: 'center' }}>
              <T v="small" color={colors.white} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 14, textTransform: 'uppercase' }}>
                {new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: timezone }).format(new Date(next.iso)).replace('.', '')}
              </T>
            </View>
            <T v="h1" maxFontSizeMultiplier={1.2} style={{ paddingVertical: 4 }}>
              {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: timezone }).format(new Date(next.iso))}
            </T>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="overline" color={colors.coralInk}>
              {timeUntil(next.iso, now)}
            </T>
            <T v="h2">{joinLabels(next.labels)}</T>
            <T v="small" color={colors.inkSoft}>
              {formatEventDate(next.iso, timezone)}
            </T>
          </View>
        </View>
      ) : null}
      <View>
        {groups.map((g, i) => {
          if (i === nextIndex) return null;
          const past = new Date(g.iso).getTime() <= now;
          return (
            <View key={g.iso} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', paddingVertical: space.sm, opacity: past ? 0.55 : 1 }}>
              <View style={{ width: 22, alignItems: 'center', paddingTop: 2 }}>
                {past ? (
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={12} color={colors.white} strokeWidth={3} />
                  </View>
                ) : (
                  <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.inkFaint, marginTop: 3 }} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <T v="label">{joinLabels(g.labels)}</T>
                <T v="small" color={colors.inkSoft}>
                  {formatEventDate(g.iso, timezone)}
                  {past ? ' · passé' : ` · ${timeUntil(g.iso, now)}`}
                </T>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
