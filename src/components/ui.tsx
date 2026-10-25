import type { ReactNode } from 'react';
import { phaseLabel } from '../domain/project';
import type { IssueStatus, PhaseId, Severity } from '../domain/types';

export const STATUS_LABEL: Record<IssueStatus, string> = {
  not_reported: 'Not yet reported',
  reported: 'Reported',
  investigating: 'Investigating',
  actions_open: 'Actions in progress',
  verified: 'Verified closed',
};

const STATUS_ICON: Record<IssueStatus, string> = {
  not_reported: '○',
  reported: '◔',
  investigating: '◑',
  actions_open: '◕',
  verified: '●',
};

export const SeverityChip = ({ severity }: { severity: Severity }) => (
  <span className={`chip sev-${severity}`}>{severity}</span>
);

export const StatusChip = ({ status }: { status: IssueStatus }) => (
  <span className={`chip st-${status}`}>
    <span aria-hidden="true">{STATUS_ICON[status]} </span>
    {STATUS_LABEL[status]}
  </span>
);

export const PhaseChip = ({ phase }: { phase: PhaseId }) => <span className="chip phase">{phaseLabel(phase)}</span>;

export const Kpi = ({ label, value, sub, tone, id }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'bad' | 'good' | 'warn'; id?: string }) => (
  <div className={`kpi ${tone ?? ''}`} data-kpi={id}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
    {sub ? <div className="kpi-sub">{sub}</div> : null}
  </div>
);

export const Card = ({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) => (
  <section className={`card ${className ?? ''}`}>
    {title ? (
      <header className="card-head">
        <h2>{title}</h2>
        {actions}
      </header>
    ) : null}
    {children}
  </section>
);

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>;
