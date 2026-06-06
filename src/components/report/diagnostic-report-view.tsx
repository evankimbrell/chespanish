'use client';
import { useState } from 'react';
import type {
  DiagnosticReport,
  CategoryDiagnostic,
  RelativeStatus,
  EvidenceStrength,
  LessonPriority,
} from '@/lib/types';

// ── Badge label + color helpers ──────────────────────────────────────────────

function statusLabel(status: RelativeStatus, level: string): string {
  switch (status) {
    case 'above_expectations': return `Above expectations for ${level}`;
    case 'on_track': return `On track for ${level}`;
    case 'slightly_below_expectations': return `Slightly below expectations for ${level}`;
    case 'below_expectations': return `Below expectations for ${level}`;
    case 'not_enough_evidence': return 'Not enough evidence yet';
    case 'not_measured': return 'Not measured yet';
  }
}

function statusColor(status: RelativeStatus): string {
  switch (status) {
    case 'above_expectations':
    case 'on_track': return 'var(--leaf)';
    case 'slightly_below_expectations': return 'var(--warm)';
    case 'below_expectations': return 'var(--crit)';
    default: return 'var(--mute)';
  }
}

const EVIDENCE_LABEL: Record<EvidenceStrength, string> = {
  strong: 'Strong evidence',
  medium: 'Medium evidence',
  light: 'Light evidence',
  not_enough: 'Not enough evidence',
  not_measured: 'Not measured',
};

const PRIORITY_LABEL: Record<LessonPriority, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
  monitor: 'Monitor',
  not_applicable: '',
};

function priorityColor(p: LessonPriority): string {
  return p === 'high' ? 'var(--crit)' : p === 'medium' ? 'var(--warm)' : 'var(--mute)';
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'var(--leaf)',
  medium: 'var(--warm)',
  low: 'var(--crit)',
};

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        color,
        background: `color-mix(in srgb, ${color} 13%, transparent)`,
        padding: '3px 8px',
        borderRadius: 3,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}

// ── Category card ─────────────────────────────────────────────────────────────

function CategoryCard({ cat, level }: { cat: CategoryDiagnostic; level: string }) {
  const [open, setOpen] = useState(false);
  const examples = cat.examples ?? [];
  return (
    <div style={{ padding: '18px 20px', borderTop: '1px solid var(--line)' }}>
      <div className="row between" style={{ alignItems: 'baseline', marginBottom: 10, gap: 12 }}>
        <span className="serif" style={{ fontSize: 18, color: 'var(--ink)' }}>{cat.displayName}</span>
        <div className="row gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end', rowGap: 6 }}>
          <Badge text={statusLabel(cat.relativeStatus, level)} color={statusColor(cat.relativeStatus)} />
          <Badge text={EVIDENCE_LABEL[cat.evidenceStrength]} color="var(--mute)" />
          {cat.lessonPriority !== 'not_applicable' && cat.lessonPriority !== 'low' && (
            <Badge text={PRIORITY_LABEL[cat.lessonPriority]} color={priorityColor(cat.lessonPriority)} />
          )}
        </div>
      </div>
      {cat.userFacingSummary && (
        <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>{cat.userFacingSummary}</p>
      )}
      {/* Examples are collapsed by default — keeps the report scannable instead of a wall of text */}
      {examples.length > 0 && (
        <>
          <button
            className="btn btn-text small"
            style={{ paddingLeft: 0, marginTop: 10 }}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? 'Hide examples' : `Show examples (${examples.length})`}
          </button>
          {open && (
            <div className="fade-in">
              {examples.map((ex, i) => (
                <div key={i} style={{ marginTop: 10, paddingLeft: 12, borderLeft: '2px solid var(--line-2)' }}>
                  {ex.learnerAnswer && (
                    <p className="serif-italic" style={{ fontSize: 14, margin: '0 0 2px', color: 'var(--ink)' }}>&ldquo;{ex.learnerAnswer}&rdquo;</p>
                  )}
                  <p className="small" style={{ margin: 0, color: 'var(--mute)' }}>{ex.observation}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ eyebrow, warm, cats, level }: { eyebrow: string; warm?: boolean; cats: CategoryDiagnostic[]; level: string }) {
  if (!cats.length) return null;
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 6, marginTop: 16 }}>
      <div style={{ padding: '14px 20px' }}>
        <span className={'eyebrow' + (warm ? ' eyebrow-warm' : '')}>{eyebrow}</span>
      </div>
      {cats.map((c) => <CategoryCard key={c.categoryId} cat={c} level={level} />)}
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────

export function DiagnosticReportView({ report, showPlacementHeader = true }: { report: DiagnosticReport; showPlacementHeader?: boolean }) {
  const { placement } = report;
  const level = placement.estimatedLevel;
  const shown = report.categories.filter((c) => c.shouldDisplay !== false);

  // Exhaustive grouping by status so no category is dropped.
  const strongest = shown.filter((c) => c.relativeStatus === 'above_expectations' || c.relativeStatus === 'on_track');
  const targets = shown.filter((c) => c.relativeStatus === 'slightly_below_expectations' || c.relativeStatus === 'below_expectations');
  const measuring = shown.filter((c) => c.relativeStatus === 'not_enough_evidence' || c.relativeStatus === 'not_measured');

  // NOTE: report.firstLessonRecommendation is intentionally NOT rendered here — it
  // duplicates the "Recommended first lesson" card at the bottom of the report page.
  // The data is still generated and persisted for internal use.

  return (
    <div>
      {/* Placement header */}
      {showPlacementHeader ? (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '24px 28px' }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>Estimated level</span>
          <h2 className="ty-h2" style={{ margin: '0 0 10px' }}>{level}</h2>
          <p className="lede" style={{ maxWidth: 620, margin: '0 0 14px' }}>{placement.shortSummary}</p>
          <div className="row gap-2" style={{ alignItems: 'center', marginBottom: 16 }}>
            <span className="mono small" style={{ color: 'var(--mute)' }}>Placement confidence:</span>
            <span className="mono small" style={{ color: CONFIDENCE_COLOR[placement.confidence] ?? 'var(--mute)', fontWeight: 600, textTransform: 'capitalize' }}>
              {placement.confidence}
            </span>
            <span className="small" style={{ color: 'var(--mute-2)' }}>· short placement test, your level keeps adjusting as we hear more</span>
          </div>
          {placement.detailedRationale && (
            <>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Why we placed you here</span>
              <p className="body" style={{ margin: 0, color: 'var(--ink-2)', maxWidth: 640 }}>{placement.detailedRationale}</p>
            </>
          )}
        </div>
      ) : (
        placement.detailedRationale && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '24px 28px' }}>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Why we placed you here</span>
            <p className="body" style={{ margin: 0, color: 'var(--ink-2)', maxWidth: 640 }}>{placement.detailedRationale}</p>
          </div>
        )
      )}

      <Section eyebrow="Strongest areas" cats={strongest} level={level} />
      <Section eyebrow="Main training targets" warm cats={targets} level={level} />
      <Section eyebrow="Still being measured" cats={measuring} level={level} />

      {/* Common patterns */}
      {report.commonErrors.length > 0 && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 6, marginTop: 16 }}>
          <div style={{ padding: '14px 20px' }}>
            <span className="eyebrow">Common patterns we noticed</span>
          </div>
          {report.commonErrors.map((e, i) => (
            <div key={i} style={{ padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
              <span className="serif" style={{ fontSize: 16, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>{e.displayName}</span>
              <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>{e.userFacingExplanation}</p>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
