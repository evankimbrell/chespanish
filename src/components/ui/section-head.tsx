import { ReactNode } from 'react';

interface SectionHeadProps {
  num?: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}

export function SectionHead({ num, title, sub, right }: SectionHeadProps) {
  return (
    <div className="section-head">
      <div className="col gap-2">
        {num && <span className="section-num">{num}</span>}
        <h2 className="ty-h2">{title}</h2>
        {sub && <p className="small" style={{ maxWidth: 560, marginTop: 4 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}
