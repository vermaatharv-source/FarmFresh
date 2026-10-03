import { useCallback, useEffect, useState } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { value: 'STATUTORY', label: 'Statutory' },
  { value: 'FINANCE', label: 'Finance & tax' },
  { value: 'GOVERNANCE', label: 'Governance' },
  { value: 'KYC', label: 'Licences & KYC' },
  { value: 'OPERATIONS', label: 'Operations' },
];

const STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NOT_APPLICABLE', label: 'Not applicable' },
];

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'done', label: 'Completed' },
  { id: 'all', label: 'All' },
];

const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label || value;

// Due dates are calendar dates stored at UTC midnight, so they are always shown in UTC.
const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : 'No date set';
const dateInputValue = (value) => (value ? String(value).slice(0, 10) : '');

const inputClass =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500';

const Tile = ({ label, value, tone }) => {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    slate: 'border-slate-200 bg-white text-slate-800',
  };
  return (
    <div className={`border rounded-xl p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] uppercase tracking-wide font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
};

function dueBadge(task) {
  if (task.status === 'COMPLETED') return { text: 'Completed', cls: 'bg-emerald-100 text-emerald-800' };
  if (task.status === 'NOT_APPLICABLE') return { text: 'Not applicable', cls: 'bg-slate-100 text-slate-600' };
  if (task.isOverdue) {
    const n = Math.abs(task.daysToDue);
    return { text: `Overdue by ${n} day${n === 1 ? '' : 's'}`, cls: 'bg-red-100 text-red-800' };
  }
  if (task.daysToDue === null || task.daysToDue === undefined) return { text: 'Date not set', cls: 'bg-slate-100 text-slate-600' };
  if (task.daysToDue === 0) return { text: 'Due today', cls: 'bg-amber-100 text-amber-800' };
  if (task.isDueSoon) return { text: `Due in ${task.daysToDue} day${task.daysToDue === 1 ? '' : 's'}`, cls: 'bg-amber-100 text-amber-800' };
  return { text: `Due in ${task.daysToDue} days`, cls: 'bg-slate-100 text-slate-700' };
}

export default function ComplianceTracker() {
  const { user } = useAuth();
  const canEdit = user?.role === 'fpo_admin';

  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('open');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'STATUTORY', dueDate: '', notes: '' });
  const [notesOpen, setNotesOpen] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await API.get('/compliance');
      setTasks(Array.isArray(res.data?.tasks) ? res.data.tasks : []);
      setSummary(res.data?.summary || null);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load compliance tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, okMessage) => {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const result = await fn();
      await load();
      if (okMessage) setNotice(typeof okMessage === 'function' ? okMessage(result) : okMessage);
      return true;
    } catch (e) {
      setError(e.response?.data?.message || 'Something went wrong. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const seed = () =>
    run(
      () => API.post('/compliance/seed-defaults'),
      (res) =>
        res.data.added
          ? `Added ${res.data.added} standard task${res.data.added === 1 ? '' : 's'}. Set each due date after checking it with your CA / Company Secretary.`
          : 'The standard checklist is already on your list.'
    );

  const addTask = async (e) => {
    e.preventDefault();
    const ok = await run(
      () => API.post('/compliance', { title: form.title, category: form.category, dueDate: form.dueDate || null, notes: form.notes }),
      'Task added.'
    );
    if (ok) setForm({ title: '', category: 'STATUTORY', dueDate: '', notes: '' });
  };

  const patch = (id, body, okMessage) => run(() => API.patch(`/compliance/${id}`, body), okMessage);

  const remove = (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    run(() => API.delete(`/compliance/${task._id}`), 'Task deleted.');
  };

  const saveNotes = async (id) => {
    const ok = await patch(id, { notes: notesDraft }, 'Notes saved.');
    if (ok) setNotesOpen(null);
  };

  const visible = tasks.filter((t) => {
    if (filter === 'open') return t.status === 'PENDING' || t.status === 'IN_PROGRESS';
    if (filter === 'overdue') return t.isOverdue;
    if (filter === 'done') return t.status === 'COMPLETED' || t.status === 'NOT_APPLICABLE';
    return true;
  });

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Statutory &amp; governance compliance</h2>
        <p className="text-sm text-slate-500 mt-1">
          Track audits, meetings, filings and licences, so nothing that affects scheme eligibility or bank loans is missed.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-sm">
        <b>FarmFresh does not know your deadlines.</b> Due dates depend on your registration type and financial year. Enter each date only after confirming it with your CA / Company Secretary.
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {notice && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm">{notice}</div>}

      {loading ? (
        <div className="bg-white border rounded-xl p-8 text-center text-slate-500">Loading compliance tasks…</div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Tile label="Overdue" value={summary?.overdue ?? 0} tone={summary?.overdue ? 'red' : 'slate'} />
            <Tile label="Due in 30 days" value={summary?.dueSoon ?? 0} tone={summary?.dueSoon ? 'amber' : 'slate'} />
            <Tile label="Open, no date set" value={summary?.noDate ?? 0} tone="slate" />
            <Tile label="Completed" value={summary?.completed ?? 0} tone="green" />
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={seed}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {tasks.length ? 'Add any missing standard tasks' : 'Add the standard checklist'}
              </button>
              <span className="text-xs text-slate-500">Adds common FPO tasks without dates. Safe to click again; nothing is duplicated.</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  filter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {visible.map((task) => {
              const badge = dueBadge(task);
              return (
                <div key={task._id} className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{task.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{categoryLabel(task.category)}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${badge.cls}`}>{badge.text}</span>
                        <span className="text-xs text-slate-500">{fmtDate(task.dueDate)}</span>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-slate-500">
                          <span className="sr-only">Due date</span>
                          <input
                            type="date"
                            value={dateInputValue(task.dueDate)}
                            disabled={busy}
                            onChange={(e) => patch(task._id, { dueDate: e.target.value || null })}
                            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="text-xs text-slate-500">
                          <span className="sr-only">Status</span>
                          <select
                            value={task.status}
                            disabled={busy}
                            onChange={(e) => patch(task._id, { status: e.target.value })}
                            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                          >
                            {STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setNotesOpen(notesOpen === task._id ? null : task._id);
                            setNotesDraft(task.notes || '');
                          }}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1.5"
                        >
                          Notes
                        </button>
                        <button type="button" onClick={() => remove(task)} disabled={busy} className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1.5">
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {task.notes && notesOpen !== task._id && <p className="mt-2 text-xs text-slate-500">{task.notes}</p>}

                  {canEdit && notesOpen === task._id && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        rows={2}
                        maxLength={1000}
                        className={inputClass}
                        placeholder="Notes: who is responsible, what the CA said, filing reference…"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => saveNotes(task._id)} disabled={busy} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-50">
                          Save notes
                        </button>
                        <button type="button" onClick={() => setNotesOpen(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {!visible.length && (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
                {tasks.length
                  ? 'No tasks in this view.'
                  : canEdit
                    ? 'No compliance tasks yet. Add the standard checklist above, or create your own task below.'
                    : 'No compliance tasks have been added yet. Ask your FPO admin to set them up.'}
              </div>
            )}
          </div>

          {canEdit && (
            <form onSubmit={addTask} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-sm text-slate-900">Add your own task</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block text-xs font-medium text-slate-600 md:col-span-2">
                  Task
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    maxLength={180}
                    required
                    className={`${inputClass} mt-1`}
                    placeholder="e.g. Renew trade licence"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Category
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={`${inputClass} mt-1`}>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Due date (optional)
                  <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className={`${inputClass} mt-1`} />
                </label>
                <label className="block text-xs font-medium text-slate-600 md:col-span-2">
                  Notes (optional)
                  <input
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    maxLength={1000}
                    className={`${inputClass} mt-1`}
                    placeholder="Who is responsible, reference numbers…"
                  />
                </label>
              </div>
              <button type="submit" disabled={busy || !form.title.trim()} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-50">
                Add task
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
