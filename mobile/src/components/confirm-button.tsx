import { useEffect, useState } from 'react';
import { Button } from './ui';

/** Action sensible en deux temps : un premier appui arme, le second confirme (5 s). */
export function ConfirmButton({ label, confirmLabel, onConfirm, loading, variant = 'danger', compact = true }: { label: string; confirmLabel: string; onConfirm: () => void; loading?: boolean; variant?: 'danger' | 'outline' | 'secondary'; compact?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      compact={compact}
      variant={armed ? 'danger' : variant}
      label={armed ? confirmLabel : label}
      loading={loading}
      accessibilityHint={armed ? 'Appuie encore pour confirmer' : undefined}
      onPress={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    />
  );
}
