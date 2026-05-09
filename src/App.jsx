import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import ScheduleForm from './pages/ScheduleForm';
import History from './pages/History';
import Settings from './pages/Settings';

const TABS = [
  { id: 'dashboard', label: 'Schedules' },
  { id: 'new', label: '+ New' },
  { id: 'history', label: 'Invoice History' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [editing, setEditing] = useState(null);

  function goEdit(s) { setEditing(s); setTab('new'); }
  function goNew() { setEditing(null); setTab('new'); }
  function done() { setEditing(null); setTab('dashboard'); }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-gray-800">Invoice Scheduler</h1>
          </div>
          <nav className="flex gap-1">
            {TABS.map(t => (
              <button key={t.id}
                onClick={() => { if (t.id === 'new') goNew(); else setTab(t.id); }}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >{t.label}</button>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === 'dashboard' && <Dashboard onEdit={goEdit} onNew={goNew} />}
        {tab === 'new' && <ScheduleForm schedule={editing} onSaved={done} onCancel={() => setTab('dashboard')} />}
        {tab === 'history' && <History />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
