import { ReactNode } from 'react';

type TagKind = 'warm' | 'leaf' | 'crit' | 'mute' | 'ink';

interface TagProps {
  kind?: TagKind;
  children: ReactNode;
}

export function Tag({ kind = 'mute', children }: TagProps) {
  return <span className={`tag tag-${kind}`}>{children}</span>;
}
