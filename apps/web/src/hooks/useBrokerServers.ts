import { useEffect, useState } from 'react';
import { accountsApi } from '@/lib/api';
import type { ComboOption } from '@/components/ui/combobox';

/** Loads broker-server suggestions when `enabled` (e.g. a dialog opens). */
export function useBrokerServers(enabled: boolean) {
  const [options, setOptions] = useState<ComboOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || options.length > 0) return;
    let cancelled = false;
    setLoading(true);
    accountsApi
      .servers()
      .then((rows) => {
        if (cancelled) return;
        setOptions(rows.map((r) => ({ value: r.server, hint: r.inUse ? 'in use' : undefined })));
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { options, loading };
}
