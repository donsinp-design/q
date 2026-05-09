import { useState, useEffect } from 'react';

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

const blank = {
  client_name: '', client_email: '', description: '',
  amount_type: 'fixed', amount: '', hours: '', rate: '',
  frequency: 'monthly',
  weekly_days: [1], monthly_day: 1, yearly_month: 0, yearly_day: 1,
  start_date: new Date().toISOString().split('T')[0],
  send_time: '09:00',
};

export default function ScheduleForm({ schedule, onSaved, onCancel }) {
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load default send_time from settings
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (s.send_time && !schedule) setF(p => ({ ...p, send_time: s.send_time }));
    });
  }, []);

  useEffect(() => {
    if (!schedule) { setF(blank); return; }
    const c = schedule.frequency_config
      ? (typeof schedule.frequency_config === 'string' ? JSON.parse(schedule.frequency_config) : schedule.frequency_config)
      : {};
    setF({
      client_name: schedule.client_name || '',
      client_email: schedule.client_email || '',
      description: schedule.description || '',
      amount_type: schedule.amount_type || 'fixed',
      amount: schedule.amount_type === 'fixed' ? (schedule.amount || '') : '',
      hours: schedule.hours || '',
      rate: schedule.rate || '',
      frequency: schedule.frequency || 'monthly',
      weekly_days: c.days || [1],
      monthly_day: c.day || 1,
      yearly_month: c.month ?? 0,
      yearly_day: c.day || 1,
      start_date: schedule.start_date || blank.start_date,
      send_time: schedule.send_time || '09:00',
    });
  }, [schedule]);

  const computed = f.amount_type === 'hours'
    ? (parseFloat(f.hours) || 0) * (parseFloat(f.rate) || 0)
    : 0;

  function getConfig() {
    if (f.frequency === 'weekly') return { days: f.weekly_days };
    if (f.frequency === 'monthly') return { day: f.monthly_day };
    if (f.frequency === 'yearly') return { month: f.yearly_month, day: f.yearly_day };
    return {};
  }

  function toggleDay(d) {
    setF(p => ({
      ...p,
      weekly_days: p.weekly_days.includes(d)
        ? p.weekly_days.filter(x => x !== d)
        : [...p.weekly_days, d].sort((a,b) => a-b)
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (f.frequency === 'weekly' && f.weekly_days.length === 0) {
      setError('Pick at least one day of the week.'); return;
    }
    setSaving(true);
    const payload = {
      client_name: f.client_name, client_email: f.client_email, description: f.description,
      amount_type: f.amount_type,
      amount: f.amount_type === 'fixed' ? parseFloat(f.amount) : null,
      hours: f.amount_type === 'hours' ? parseFloat(f.hours) : null,
      rate: f.amount_type === 'hours' ? parseFloat(f.rate) : null,
      frequency: f.frequency, frequency_config: getConfig(),
      start_date: f.start_date, send_time: f.send_time,
    };
    const url = schedule ? `/api/schedules/${schedule.id}` : '/api/schedules';
    const res = await fetch(url, { method: schedule ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (data.error) setError(data.error);
    else onSaved();
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';
  const label = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={submit} className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-gray-800">
          {schedule ? 'Edit Schedule' : 'New Invoice Schedule'}
        </h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {/* Client */}
      <section className="bg-white rounded-xl border p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Client</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Client Name *</label>
            <input className={inp} type="text" value={f.client_name} placeholder="Acme Corp"
              onChange={e => setF(p => ({...p, client_name: e.target.value}))} required />
          </div>
          <div>
            <label className={label}>Client Email *</label>
            <input className={inp} type="email" value={f.client_email} placeholder="billing@acme.com"
              onChange={e => setF(p => ({...p, client_email: e.target.value}))} required />
          </div>
        </div>
        <div className="mt-4">
          <label className={label}>Description / Service</label>
          <input className={inp} type="text" value={f.description} placeholder="Web Development Services"
            onChange={e => setF(p => ({...p, description: e.target.value}))} />
        </div>
      </section>

      {/* Amount */}
      <section className="bg-white rounded-xl border p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Amount</h3>
        <div className="flex gap-6 mb-4">
          {['fixed', 'hours'].map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={f.amount_type === t} onChange={() => setF(p => ({...p, amount_type: t}))}
                className="accent-indigo-600" />
              <span className="text-sm font-medium text-gray-700">{t === 'fixed' ? 'Fixed Amount' : 'Hours × Rate'}</span>
            </label>
          ))}
        </div>

        {f.amount_type === 'fixed' ? (
          <div className="flex items-center gap-2 max-w-xs">
            <span className="text-gray-500 font-medium">$</span>
            <input className={inp} type="number" value={f.amount} placeholder="0.00"
              step="0.01" min="0" required
              onChange={e => setF(p => ({...p, amount: e.target.value}))} />
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-28"
                type="number" value={f.hours} placeholder="Hours" step="0.5" min="0" required
                onChange={e => setF(p => ({...p, hours: e.target.value}))} />
              <span className="text-gray-500 text-sm">hrs</span>
            </div>
            <span className="text-gray-400 font-bold">×</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-28"
                type="number" value={f.rate} placeholder="Rate/hr" step="0.01" min="0" required
                onChange={e => setF(p => ({...p, rate: e.target.value}))} />
              <span className="text-gray-500 text-sm">/hr</span>
            </div>
            {computed > 0 && (
              <>
                <span className="text-gray-400">=</span>
                <span className="font-bold text-indigo-600 text-lg">
                  {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(computed)}
                </span>
              </>
            )}
          </div>
        )}
      </section>

      {/* Schedule */}
      <section className="bg-white rounded-xl border p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Schedule</h3>

        {/* Frequency picker */}
        <div className="flex flex-wrap gap-2 mb-5">
          {['daily','weekly','monthly','yearly'].map(freq => (
            <button key={freq} type="button"
              onClick={() => setF(p => ({...p, frequency: freq}))}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
                f.frequency === freq
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
              }`}>
              {freq.charAt(0).toUpperCase() + freq.slice(1)}
            </button>
          ))}
        </div>

        {/* Weekly: day picker */}
        {f.frequency === 'weekly' && (
          <div className="mb-5">
            <p className="text-sm text-gray-600 mb-2">Send on:</p>
            <div className="flex gap-2">
              {WEEKDAYS.map((d, i) => (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  className={`w-10 h-10 rounded-full text-xs font-semibold transition ${
                    f.weekly_days.includes(i)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Monthly: day picker */}
        {f.frequency === 'monthly' && (
          <div className="mb-5 flex items-center gap-3">
            <span className="text-sm text-gray-600">On the</span>
            <select value={f.monthly_day}
              onChange={e => setF(p => ({...p, monthly_day: parseInt(e.target.value)}))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Array.from({length:28},(_,i)=>i+1).map(d => (
                <option key={d} value={d}>{ordinal(d)}</option>
              ))}
            </select>
            <span className="text-sm text-gray-600">of each month</span>
          </div>
        )}

        {/* Yearly: month + day */}
        {f.frequency === 'yearly' && (
          <div className="mb-5 flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-600">Every year on</span>
            <select value={f.yearly_month}
              onChange={e => setF(p => ({...p, yearly_month: parseInt(e.target.value)}))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {MONTHS_LONG.map((m,i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={f.yearly_day}
              onChange={e => setF(p => ({...p, yearly_day: parseInt(e.target.value)}))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Array.from({length:28},(_,i)=>i+1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        {/* Start date + time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Start Date *</label>
            <input className={inp} type="date" value={f.start_date} required
              onChange={e => setF(p => ({...p, start_date: e.target.value}))} />
            <p className="text-xs text-gray-400 mt-1">First invoice goes out on or after this date</p>
          </div>
          <div>
            <label className={label}>Send Time</label>
            <input className={inp} type="time" value={f.send_time}
              onChange={e => setF(p => ({...p, send_time: e.target.value}))} />
            <p className="text-xs text-gray-400 mt-1">Server local time</p>
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition text-sm">
          {saving ? 'Saving…' : schedule ? 'Update Schedule' : 'Create Schedule'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
