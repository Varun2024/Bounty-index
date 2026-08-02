'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCompareSelection } from '@/lib/compare';

interface RemoveColumnButtonProps {
  programId: number;
}

export function RemoveColumnButton({ programId }: RemoveColumnButtonProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const { remove } = useCompareSelection();

  const onClick = () => {
    remove(programId);
    const idsParam = sp?.get('ids') ?? '';
    const next = idsParam.split(',').filter((s) => s && Number(s) !== programId);
    if (next.length === 0) router.push('/compare');
    else router.push(`/compare?ids=${next.join(',')}`);
  };

  return (
    <button
      onClick={onClick}
      aria-label="Remove from comparison"
      title="Remove"
      className="mono text-neutral-600 hover:text-neutral-200 text-sm w-6 h-6 rounded hover:bg-neutral-900 transition"
    >
      ×
    </button>
  );
}
