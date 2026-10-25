import type { ReactElement } from 'react';
import type { SceneComponent, SceneState } from './scene';
import type { Severity } from '../domain/types';

/** Any renderer (isometric SVG today, 3D later) consumes the same scene state. */
export interface SceneRendererProps {
  scene: SceneState;
  onSelectIssue?: (issueId: string) => void;
  title: string;
}
export type SceneRenderer = (props: SceneRendererProps) => ReactElement;

const TW = 20;
const TH = 10;
const ZH = 22;
const OX = 210;
const OY = 50;

const iso = (x: number, y: number, z: number): [number, number] => [(x - y) * TW + OX, (x + y) * TH - z * ZH + OY];
const pts = (arr: [number, number][]): string => arr.map((p) => p.join(',')).join(' ');

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#c62828',
  high: '#ef6c00',
  medium: '#f9a825',
  low: '#5c7a99',
};

const STATE_COLORS: Record<SceneComponent['state'], { top: string; left: string; right: string }> = {
  planned: { top: '#e8edf2', left: '#d5dce4', right: '#c5cdd6' },
  building: { top: '#b8c7d8', left: '#98aabd', right: '#8396aa' },
  healthy: { top: '#c9d5e2', left: '#a9b9ca', right: '#8fa1b5' },
  issue_open: { top: '#f4c7c3', left: '#e5a29c', right: '#d58983' },
  verified: { top: '#bfe3cc', left: '#9ccdb0', right: '#82b99a' },
};

const Box = ({ c }: { c: SceneComponent }) => {
  const h = Math.max(c.h * c.build, 0.02);
  const { x, y, w, d } = c;
  const colors = STATE_COLORS[c.state];
  const ghost = c.build <= 0;
  const top = pts([iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)]);
  const left = pts([iso(x, y + d, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x, y + d, h)]);
  const right = pts([iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x + w, y, h)]);
  const isHall = c.id === 'hallA' || c.id === 'hallB';
  const racks: ReactElement[] = [];
  if (isHall && c.build > 0.55) {
    for (let r = 0; r < 4; r += 1) {
      const ry = y + 0.5 + r * 0.7;
      racks.push(
        <polygon
          key={r}
          points={pts([iso(x + 0.4, ry, h + 0.02), iso(x + w - 0.4, ry, h + 0.02), iso(x + w - 0.4, ry + 0.3, h + 0.02), iso(x + 0.4, ry + 0.3, h + 0.02)])}
          fill={c.energized ? '#4fc3f7' : '#6b7c8f'}
          opacity={c.energized ? 0.95 : 0.6}
        />,
      );
    }
  }
  return (
    <g opacity={ghost ? 0.55 : 1} data-component={c.id} data-state={c.state}>
      <polygon points={left} fill={colors.left} stroke="#6f7f91" strokeWidth={0.8} strokeDasharray={ghost ? '3 3' : undefined} />
      <polygon points={right} fill={colors.right} stroke="#6f7f91" strokeWidth={0.8} strokeDasharray={ghost ? '3 3' : undefined} />
      <polygon points={top} fill={colors.top} stroke="#6f7f91" strokeWidth={0.8} strokeDasharray={ghost ? '3 3' : undefined} />
      {racks}
    </g>
  );
};

export const IsoRenderer: SceneRenderer = ({ scene, onSelectIssue, title }) => {
  const ordered = [...scene.components].sort((a, b) => a.x + a.y + a.w + a.d - (b.x + b.y + b.w + b.d));
  const pad = ordered.filter((c) => c.id === 'pad');
  const rest = ordered.filter((c) => c.id !== 'pad');
  const open = scene.components.reduce((n, c) => n + c.openIssueIds.length, 0);
  return (
    <svg
      viewBox="0 0 500 300"
      role="group"
      aria-label={`${title}: isometric site view on project day ${scene.day}, ${open} open issues`}
      className="iso-svg"
    >
      {pad.map((c) => (
        <Box key={c.id} c={c} />
      ))}
      {rest.map((c) => (
        <Box key={c.id} c={c} />
      ))}
      {rest.map((c) => {
        const [cx, cy] = iso(c.x + c.w / 2, c.y + c.d / 2, Math.max(c.h * c.build, 0.02));
        return (
          <g key={`l-${c.id}`}>
            <text x={cx} y={cy + 4} textAnchor="middle" className="iso-label">
              {c.label}
            </text>
          </g>
        );
      })}
      {rest.map((c) =>
        c.openIssueIds.map((id, idx) => {
          const [cx, cy] = iso(c.x + c.w / 2, c.y + c.d / 2, Math.max(c.h * c.build, 0.02));
          const px = cx + (idx - (c.openIssueIds.length - 1) / 2) * 22;
          const py = cy - 24;
          const color = SEVERITY_COLOR[c.worstOpen ?? 'medium'];
          return (
            <g
              key={id}
              className="iso-marker"
              role="button"
              tabIndex={0}
              aria-label={`Open issue ${id} on ${c.label}`}
              data-issue={id}
              onClick={() => onSelectIssue?.(id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectIssue?.(id)}
            >
              <line x1={px} y1={py + 8} x2={cx} y2={cy} stroke={color} strokeWidth={1} />
              <circle cx={px} cy={py} r={9} fill={color} stroke="#fff" strokeWidth={1.5} />
              <text x={px} y={py + 3.5} textAnchor="middle" className="iso-marker-text">
                !
              </text>
            </g>
          );
        }),
      )}
    </svg>
  );
};
