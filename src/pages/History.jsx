import { useState, useEffect } from 'react';

function fmtAmt(n) {
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n||0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
}

export default function History() {
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/invoices').then(r => r.json()).then(setInvoices);
  }, []);

  const shown = invoices.filter(i => filter === 'all' || i.status === filter);
  const sent = invoices.filter(i => i.status === 'sent').length;
  const failed = invoices.filter(i => i.status === 'failed').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Invoice History</h2>
          <p className="text-sm text-gray-500 mt-0.5">{sent} sent · {failed} failed</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[['all','All'],['sent','Sent'],['failed','Failed']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition ${filter === v ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-400">No invoices yet</p>
        </div>
      )}

      {shown.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Description</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Sent</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((inv, idx) => (
                <tr key={inv.id} className={`border-b last:border-0 hover:bg-gray-50 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-3 font-mono font-medium text-indigo-600">{inv.invoice_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{inv.client_name}</p>
                    <p className="text-xs text-gray-400">{inv.client_email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-xs truncate">{inv.description || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtAmt(inv.amount)}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell whitespace-nowrap">{fmtDate(inv.sent_at)}</td>
                  <td className="px-4 py-3 text-center">
                    {inv.status === 'sent' ? (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                        Sent
                      </span>
                    ) : (
                      <span title={inv.error_message} className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium cursor-help">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium whitespace-nowrap">
                      PDF ↓
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
