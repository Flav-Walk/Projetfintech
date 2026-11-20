import { createElement } from 'react';
import { View } from 'react-native';
import { colors, fonts, radius } from '@/theme/tokens';
import { T } from './ui';

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Version web (vérification navigateur) : champ datetime-local natif. */
export function DateField({ label, value, onChange, minimumDate, error, hint }: { label: string; value: Date; onChange: (d: Date) => void; minimumDate?: Date; error?: string | null; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="label">{label}</T>
      {createElement('input', {
        type: 'datetime-local',
        'aria-label': label,
        value: toLocalInput(value),
        min: minimumDate ? toLocalInput(minimumDate) : undefined,
        onChange: (e: { target: { value: string } }) => {
          const d = new Date(e.target.value);
          if (!Number.isNaN(d.getTime())) onChange(d);
        },
        style: {
          minHeight: 52,
          borderRadius: radius.field,
          border: `${error ? 2 : 1.5}px solid ${error ? colors.danger : colors.border}`,
          background: colors.surface,
          padding: '0 12px',
          fontFamily: fonts.semiBold,
          fontSize: 16,
          color: colors.ink,
        },
      })}
      {error ? <T v="small" color={colors.danger}>{error}</T> : hint ? <T v="small" color={colors.inkSoft}>{hint}</T> : null}
    </View>
  );
}
