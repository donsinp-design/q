import { useState, useEffect } from 'react';

export default function Settings() {
  const [f, setF] = useState({
    your_name:'', your_company:'', your_email:'',
    smtp_host:'', smtp_port:'587', smtp_user:'', smtp_pass:'', smtp_secure:false, send_time:'09:00'
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState('');
  const [toastOk, setToastOk] = useState(true);
  const [showPass, setShowPass] = useState(false);

  function notify(msg, ok = true) {
    setToast(msg); setToastOk(ok);
    setTimeout(() => setToast(''), 4000);
  }

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setF({
        your_name: s.your_name||'', your_company: s.your_company||'',
        your_email: s.your_email||'', smtp_host: s.smtp_host||'',
        smtp_port: String(s.smtp_port||587), smtp_user: s.smtp_user||'',
        smtp_pass: s.smtp_pass||'', smtp_secure: !!s.smtp_secure,
        send_time: s.send_time||'09:00',
      });
    });
  }, []);

  async function save(e) {
    e.preventDefault(); setSaving(true);
    const r = await fetch('/api/settings', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({...f, smtp_port: parseInt(f.smtp_port)||587}),
    });
    const d = await r.json(); setSaving(false);
    if (d.error) notify('Error: ' + d.error, false);
    else notify('Settings saved!', true);
  }

  async function testEmail() {
    setTesting(true);
    const r = await fetch('/api/settings/test-email', { method: 'POST' });
    const d = await r.json(); setTesting(false);
    if (d.error) notify('Error: ' + d.error, false);
    else notify('Test email sent! Check your inbox.', true);
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';
  const label = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={save} className="max-w-2xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toastOk ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast}
        </div>
      )}

      <h2 className="text-xl font-bold text-gray-800 mb-6">Settings</h2>

      {/* Your Info */}
      <section className="bg-white rounded-xl border p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">Your Information</h3>
        <p className="text-xs text-gray-400 mb-4">This appears on every invoice PDF and email.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Your Name</label>
            <input className={inp} type="text" value={f.your_name} placeholder="Jane Smith"
              onChange={e => setF(p=>({...p, your_name:e.target.value}))} />
          </div>
          <div>
            <label className={label}>Company Name</label>
            <input className={inp} type="text" value={f.your_company} placeholder="Smith Design Co."
              onChange={e => setF(p=>({...p, your_company:e.target.value}))} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Your Email (CC on all invoices)</label>
            <input className={inp} type="email" value={f.your_email} placeholder="you@example.com"
              onChange={e => setF(p=>({...p, your_email:e.target.value}))} />
            <p className="text-xs text-gray-400 mt-1">You'll receive a copy of every invoice sent</p>
          </div>
          <div>
            <label className={label}>Default Send Time</label>
            <input className={inp} type="time" value={f.send_time}
              onChange={e => setF(p=>({...p, send_time:e.target.value}))} />
            <p className="text-xs text-gray-400 mt-1">Pre-filled when creating new schedules</p>
          </div>
        </div>
      </section>

      {/* SMTP */}
      <section className="bg-white rounded-xl border p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1 text-sm uppercase tracking-wide">SMTP Email Settings</h3>
        <p className="text-xs text-gray-400 mb-4">Invoices are sent via your own email account.</p>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2">
            <label className={label}>SMTP Host</label>
            <input className={inp} type="text" value={f.smtp_host} placeholder="smtp.gmail.com"
              onChange={e => setF(p=>({...p, smtp_host:e.target.value}))} />
          </div>
          <div>
            <label className={label}>Port</label>
            <input className={inp} type="number" value={f.smtp_port} placeholder="587"
              onChange={e => setF(p=>({...p, smtp_port:e.target.value}))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={label}>Username / Email</label>
            <input className={inp} type="text" value={f.smtp_user} placeholder="you@gmail.com"
              onChange={e => setF(p=>({...p, smtp_user:e.target.value}))} />
          </div>
          <div>
            <label className={label}>Password / App Password</label>
            <div className="relative">
              <input className={inp + ' pr-10'} type={showPass ? 'text' : 'password'} value={f.smtp_pass}
                placeholder="••••••••••••"
                onChange={e => setF(p=>({...p, smtp_pass:e.target.value}))} />
              <button type="button" onClick={() => setShowPass(p=>!p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1">
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={f.smtp_secure} onChange={e => setF(p=>({...p, smtp_secure:e.target.checked}))}
            className="w-4 h-4 accent-indigo-600 rounded" />
          <span className="text-sm text-gray-700">Use SSL/TLS (port 465) — uncheck for STARTTLS (port 587)</span>
        </label>

        {/* Provider hints */}
        <details className="mt-4">
          <summary className="text-xs text-indigo-600 cursor-pointer font-medium">Provider quick-reference</summary>
          <div className="mt-3 text-xs text-gray-600 space-y-2 bg-gray-50 rounded-lg p-3">
            <p><strong>Gmail:</strong> smtp.gmail.com · port 587 · STARTTLS. Use an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-indigo-600 underline">App Password</a> (requires 2FA).</p>
            <p><strong>Outlook / Hotmail:</strong> smtp-mail.outlook.com · port 587 · STARTTLS.</p>
            <p><strong>iCloud:</strong> smtp.mail.me.com · port 587 · STARTTLS. Use an App-Specific Password.</p>
            <p><strong>SendGrid:</strong> smtp.sendgrid.net · port 587 · username: <code>apikey</code> · password: your API key.</p>
          </div>
        </details>
      </section>

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition text-sm">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        <button type="button" onClick={testEmail} disabled={testing}
          className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition text-sm">
          {testing ? 'Sending…' : 'Send Test Email'}
        </button>
      </div>
    </form>
  );
}
