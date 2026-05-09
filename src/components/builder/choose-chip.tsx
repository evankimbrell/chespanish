'use client';
import { Icons } from '@/components/ui/icons';

interface ChooseChipProps {
  selected: boolean;
  onClick: () => void;
}

export function ChooseChip({ selected, onClick }: ChooseChipProps) {
  return (
    <button
      onClick={onClick}
      className={'chip chip-square' + (selected ? ' selected' : '')}
      style={{
        borderStyle: selected ? 'solid' : 'dashed',
        borderColor: selected ? undefined : 'var(--warm)',
        color: selected ? undefined : 'var(--warm)',
      }}
    >
      <Icons.spark /> Choose for me
    </button>
  );
}
