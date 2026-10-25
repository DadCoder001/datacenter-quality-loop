import { useStore } from './data/store';
import { PROJECT_LENGTH_DAYS, PROJECT_NAME, phaseLabel, phaseOfDay } from './domain/project';
import { useRoute, type Route } from './components/router';
import { SimulationView } from './features/SimulationView';
import { DashboardView } from './features/DashboardView';
import { RegisterView } from './features/RegisterView';
import { IssueWorkspace } from './features/IssueWorkspace';
import { ActionBoard } from './features/ActionBoard';
import { LearningView } from './features/LearningView';

const NAV: { name: Route['name']; label: string }[] = [
  { name: 'sim', label: 'Simulation' },
  { name: 'dashboard', label: 'Dashboard' },
  { name: 'register', label: 'Issues' },
  { name: 'actions', label: 'Actions' },
  { name: 'learning', label: 'Learning' },
];

export default function App() {
  const route = useRoute();
  const day = useStore((s) => s.asOfDay);
  const setDay = useStore((s) => s.setAsOfDay);
  const resetAll = useStore((s) => s.resetAll);
  const activeName = route.name === 'issue' ? 'register' : route.name;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo" aria-hidden="true">◎</span> Quality Loop</div>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <a key={n.name} href={`#/${n.name}`} className={activeName === n.name ? 'active' : ''} aria-current={activeName === n.name ? 'page' : undefined}>{n.label}</a>
          ))}
        </nav>
        <div className="dayctl">
          <label htmlFor="day-range">Project day</label>
          <input id="day-range" type="range" min={0} max={PROJECT_LENGTH_DAYS} value={day} onChange={(e) => setDay(Number(e.target.value))} />
          <span className="day-pill" data-testid="header-day">{day} · {phaseLabel(phaseOfDay(day))}</span>
        </div>
      </header>
      <div className="banner" role="note">
        Demo data: {PROJECT_NAME} is a fictional data-center project. Figures are illustrative, based on adjustable assumptions, and are not
        forecasts or real operational data.
        <button type="button" className="link" onClick={() => { if (window.confirm('Reset all demo data and edits?')) resetAll(); }}>Reset demo data</button>
      </div>
      <main>
        {route.name === 'sim' && <SimulationView />}
        {route.name === 'dashboard' && <DashboardView />}
        {route.name === 'register' && <RegisterView />}
        {route.name === 'issue' && route.param ? <IssueWorkspace id={route.param} /> : null}
        {route.name === 'actions' && <ActionBoard />}
        {route.name === 'learning' && <LearningView />}
      </main>
    </div>
  );
}
