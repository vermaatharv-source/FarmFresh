import BrandLogo from '../components/BrandLogo';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

/**
 * Government / Authority portal (role: admin).
 * Lists every FPO with its KYC status and lets the reviewer open the FPO's full
 * record and uploaded documents before verifying or rejecting it. Farmer personal
 * data is never shown here. Every document view and every decision is recorded in
 * the audit log.
 */
const STATUS_STYLE = {
  Verified: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
  Pending: 'bg-amber-100 text-amber-800',
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const Field = ({ label, value }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
    <p className="text-sm text-slate-900 break-words">{value || '—'}</p>
  </div>
);

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [fpos, setFpos] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Review panel
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const q = statusFilter ? `?status=${statusFilter}` : '';
      const res = await API.get(`/fpo/admin/fpos${q}`);
      setFpos(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load FPO registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openReview = async (fpoId) => {
    setDetail(null);
    setRejecting(false);
    setReason('');
    setDetailLoading(true);
    try {
      const res = await API.get(`/fpo/admin/fpos/${fpoId}`);
      setDetail(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the FPO record');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeReview = () => {
    setDetail(null);
    setDetailLoading(false);
    setRejecting(false);
    setReason('');
  };

  // Documents are private: fetched with the reviewer's login and shown from a temporary local URL.
  const viewDocument = async (fpoId, index) => {
    const win = window.open('', '_blank');
    try {
      const res = await API.get(`/fpo/admin/fpos/${fpoId}/documents/${index}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      if (win) win.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      if (win) win.close();
      setError('Could not open the document. It may be missing on the server.');
    }
  };

  const decide = async (status) => {
    if (!detail) return;
    if (status === 'Rejected' && !reason.trim()) return;
    if (
      status === 'Verified' &&
      !window.confirm(`Confirm: mark ${detail.name} as KYC Verified? The FPO will be allowed to publish listings and record payouts.`)
    ) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await API.patch(`/fpo/kyc/${detail._id}/status`, { status, reason: reason.trim() });
      setActionMsg(`${detail.name}: KYC set to ${status}`);
      setTimeout(() => setActionMsg(''), 3000);
      closeReview();
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'KYC update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const counts = {
    total: fpos.length,
    verified: fpos.filter((f) => f.kycStatus === 'Verified').length,
    pending: fpos.filter((f) => f.kycStatus === 'Pending').length,
    rejected: fpos.filter((f) => f.kycStatus === 'Rejected').length,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fpos;
    return fpos.filter((f) =>
      [f.name, f.registrationNumber, f.contactDetails?.district, f.contactDetails?.state]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [fpos, search]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">Authority Portal</p>
              <h1 className="text-lg font-semibold">FPO Registry & Compliance</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">{user?.name}</span>
            <button onClick={handleLogout} className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500">Dismiss</button>
          </div>
        )}
        {actionMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded text-sm">{actionMsg}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total FPOs', value: counts.total, color: 'bg-white' },
            { label: 'KYC Verified', value: counts.verified, color: 'bg-emerald-50' },
            { label: 'Pending review', value: counts.pending, color: 'bg-amber-50' },
            { label: 'Rejected', value: counts.rejected, color: 'bg-red-50' },
          ].map((c) => (
            <div key={c.label} className={`${c.color} border rounded-lg p-4`}>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{c.label}</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-slate-600">KYC status:</span>
            {['', 'Pending', 'Verified', 'Rejected'].map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded text-sm border ${
                  statusFilter === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, registration no., district or state"
            className="border rounded px-3 py-1.5 text-sm w-full md:w-80 bg-white"
          />
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">FPO Name</th>
                  <th className="px-4 py-3 font-medium">Registration No.</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">District / State</th>
                  <th className="px-4 py-3 font-medium">Shareholders</th>
                  <th className="px-4 py-3 font-medium">Documents</th>
                  <th className="px-4 py-3 font-medium">KYC</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading registry…</td></tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No FPOs found.</td></tr>
                )}
                {visible.map((f) => (
                  <tr key={f._id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{f.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{f.registrationNumber}</td>
                    <td className="px-4 py-3">{f.registrationType || '—'}</td>
                    <td className="px-4 py-3">
                      {[f.contactDetails?.district, f.contactDetails?.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">{f.shareholderFarmerCount ?? '—'}</td>
                    <td className="px-4 py-3">{f.kycDocuments?.length || 0}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[f.kycStatus] || STATUS_STYLE.Pending}`}>
                        {f.kycStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openReview(f._id)} className="text-xs font-medium text-slate-900 border rounded px-3 py-1 hover:bg-slate-100">
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Compliance view for authority administrators. Farmer personal data (Aadhaar, bank details, phone numbers) is not
          exposed here. Opening a document and every KYC decision are recorded in the audit log.
        </p>
      </main>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={closeReview}>
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            {detailLoading && <p className="p-8 text-slate-500">Loading record…</p>}
            {detail && (
              <div>
                <div className="px-6 py-4 border-b flex items-start justify-between sticky top-0 bg-white">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">KYC review</p>
                    <h2 className="text-lg font-semibold text-slate-900">{detail.name}</h2>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[detail.kycStatus] || STATUS_STYLE.Pending}`}>
                      KYC {detail.kycStatus}
                    </span>
                  </div>
                  <button onClick={closeReview} className="text-slate-500 hover:text-slate-800 text-sm">Close</button>
                </div>

                <div className="p-6 space-y-6">
                  {detail.kycStatus === 'Rejected' && detail.kycRejectionReason && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
                      Previous rejection reason: {detail.kycRejectionReason}
                    </div>
                  )}

                  <section>
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Organisation</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Registration type" value={detail.registrationType} />
                      <Field label="Registration number" value={detail.registrationNumber} />
                      <Field label="Date of incorporation" value={fmtDate(detail.dateOfIncorporation)} />
                      <Field label="Registered on platform" value={fmtDate(detail.createdAt)} />
                      <Field label="PAN" value={detail.pan} />
                      <Field label="GSTIN" value={detail.gstin} />
                      <Field label="FSSAI licence" value={detail.fssaiLicense} />
                      <Field label="Udyam registration" value={detail.udyamNumber} />
                      <Field label="Promoting agency / CBBO" value={detail.cbboName} />
                      <Field label="Scheme" value={detail.schemeName} />
                      <Field label="Shareholder farmers (declared)" value={detail.shareholderFarmerCount} />
                      <Field label="Farmers on the platform" value={detail.farmerCount} />
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Contact and management</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Registered address" value={[detail.contactDetails?.address, detail.contactDetails?.district, detail.contactDetails?.state, detail.contactDetails?.pincode].filter(Boolean).join(', ')} />
                      <Field label="Organisation phone / email" value={[detail.contactDetails?.phone, detail.contactDetails?.email].filter(Boolean).join(' · ')} />
                      <Field label="Manager / CEO" value={detail.managerName} />
                      <Field label="Manager contact" value={detail.managerContact} />
                      <Field label="Account holder" value={detail.adminUser?.name} />
                      <Field label="Account email" value={detail.adminUser?.email} />
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">KYC documents ({detail.documents.length})</h3>
                    {detail.documents.length === 0 ? (
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                        This FPO has not uploaded any documents yet, so it cannot be verified.
                      </p>
                    ) : (
                      <ul className="divide-y border rounded">
                        {detail.documents.map((d) => (
                          <li key={d.index} className="flex items-center justify-between px-4 py-2.5 text-sm">
                            <span>{d.label} <span className="text-xs text-slate-500">({d.type})</span></span>
                            {d.available ? (
                              <button onClick={() => viewDocument(detail._id, d.index)} className="text-slate-900 font-medium underline">
                                View
                              </button>
                            ) : (
                              <span className="text-xs text-red-600">File missing on server</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Decision</h3>
                    {rejecting ? (
                      <div className="space-y-3">
                        <label className="text-xs text-slate-600">
                          Reason for rejection (shown to the FPO so they can correct it)
                          <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            className="mt-1 w-full border rounded px-3 py-2 text-sm"
                            placeholder="e.g. PAN on the certificate does not match the details entered"
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => decide('Rejected')}
                            disabled={saving || !reason.trim()}
                            className="bg-red-600 text-white text-sm px-4 py-2 rounded disabled:opacity-40"
                          >
                            Confirm rejection
                          </button>
                          <button onClick={() => setRejecting(false)} className="text-sm px-4 py-2 border rounded">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {detail.kycStatus !== 'Verified' && (
                          <button
                            onClick={() => decide('Verified')}
                            disabled={saving || detail.documents.length === 0}
                            className="bg-emerald-700 text-white text-sm px-4 py-2 rounded disabled:opacity-40"
                          >
                            Verify KYC
                          </button>
                        )}
                        {detail.kycStatus !== 'Rejected' && (
                          <button onClick={() => setRejecting(true)} className="bg-white text-red-700 border border-red-300 text-sm px-4 py-2 rounded">
                            Reject
                          </button>
                        )}
                        {detail.kycStatus !== 'Pending' && (
                          <button onClick={() => decide('Pending')} disabled={saving} className="text-sm px-4 py-2 border rounded text-slate-700">
                            Move back to Pending
                          </button>
                        )}
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Recent activity of this FPO</h3>
                    {detail.recentActivity.length === 0 ? (
                      <p className="text-sm text-slate-500">No activity recorded yet.</p>
                    ) : (
                      <ul className="text-xs text-slate-600 space-y-1.5">
                        {detail.recentActivity.map((a, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span>{a.summary} <span className="text-slate-400">— {a.actorName || a.actorRole}</span></span>
                            <span className="text-slate-400 whitespace-nowrap">{fmtDateTime(a.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
