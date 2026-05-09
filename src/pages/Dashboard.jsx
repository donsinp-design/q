import { useState, useEffect } from 'react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

function freqLabel(s) {
  const c = s.frequency_config ? (typeof s.frequency_config === 'string' ? JSON.parse(s.frequency_config) : s.frequency_config) : {};
  switch (s.frequency) {
    case 'daily': return 'Every day';
    case 'weekly': return `Every ${(c.days||[1]).map(d => DAYS[d]).join(', ')}`;
    case 'monthly': return `Monthly on the ${ordinal(c.day||1)}`;
    case 'yearly': return `Yearly — ${MONTHS[c.month??0]} ${c.day||1}`;
    default: return s.frequency;
  }
}

function nextRunLabel(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' });
}

function fmtAmt(s) {
  const n = s.amount || 0;
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n);
}

export default function Dashboard({ onEdit, onNew }) {
  const [schedules, setSchedules] = useState([]);
  const [toast, setToast] = useState('');
  const [toastOk, setToastOk] = useState(true);
  const [sending, setSending] = useState(null);

  function notify(msg, ok = true) {
    setToast(msg); setToastOk(ok);
    setTimeout(() => setToast(''), 4000);
  }

  async function load() {
    const r = await fetch('/api/schedules');
    setSchedules(await r.json());
  }

  useEffect(() => { load(); }, []);

  async function toggle(id) {
    await fetch(`/api/schedules/${id}/toggle`, { method: 'POST' });
    load();
  }

  async function del(id, name) {
    if (!confirm(`Delete schedule for "${name}"?`)) return;
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    load();
  }

  async function sendNow(id) {
    setSending(id);
    const r = await fetch(`/api/schedules/${id}/send-now`, { method: 'POST' });
    const d = await r.json();
    setSending(null);
    if (d.error) notify('Error: ' + d.error, false);
    else notify('Invoice sent!', true);
    load();
  }

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${toastOk ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Invoice Schedules</h2>
          <p className="text-sm text-gray-500 mt-0.5">{schedules.length} schedule{schedules.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={onNew} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          + New Schedule
        </button>
      </div>

      {schedules.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <div className="text-4xl mb-3">📄</div>
          <p className="text-gray-500 font-medium">No schedules yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-4">Create your first recurring invoice schedule</p>
          <button onClick={onNew} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
            Get Started
          </button>
        </div>
      )}

      <div className="space-y-3">
        {schedules.map(s => (
          <div key={s.id} className={`bg-white rounded-xl border p-5 transition-opacity ${!s.active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-800 text-base">{s.client_name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">{s.client_email}</p>
                {s.description && <p className="text-sm text-gray-600 mt-1">{s.description}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-indigo-600">{fmtAmt(s)}</p>
                {s.amount_type === 'hours' && (
                  <p className="text-xs text-gray-400">{s.hours}h × ${s.rate}/hr</p>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {freqLabel(s)}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Next: {nextRunLabel(s.next_run)}
              </span>
              {s.send_time && (
                <span className="text-gray-400">@ {s.send_time}</span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => sendNow(s.id)} disabled={sending === s.id}
                className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition disabled:opacity-50">
                {sending === s.id ? 'Sending…' : 'Send Now'}
              </button>
              <button onClick={() => onEdit(s)}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition">
                Edit
              </button>
              <button onClick={() => toggle(s.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${s.active ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                {s.active ? 'Pause' : 'Resume'}
              </button>
              <button onClick={() => del(s.id, s.client_name)}
                className="text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition ml-auto">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
