import BrandLogo from '../components/BrandLogo';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';

/**
 * Read-only Government / Authority dashboard.
 * Lists all FPOs with KYC status, district, shareholder counts.
 * Role required: admin
 */
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [fpos, setFpos] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

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
  }, [statusFilter]);

  const setKyc = async (fpoId, status) => {
    const reason =
      status === 'Rejected' ? window.prompt('Rejection reason (optional):') || '' : '';
    try {
      await API.patch(`/fpo/kyc/${fpoId}/status`, { status, reason });
      setActionMsg(`KYC set to ${status}`);
      load();
      setTimeout(() => setActionMsg(''), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'KYC update failed');
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

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <BrandLogo size="sm" />
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Authority Portal</p>
                <h1 className="text-lg font-semibold">FPO Registry & Compliance</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}
        {actionMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded text-sm">
            {actionMsg}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total FPOs', value: counts.total, color: 'bg-white' },
            { label: 'KYC Verified', value: counts.verified, color: 'bg-emerald-50' },
            { label: 'Pending', value: counts.pending, color: 'bg-amber-50' },
            { label: 'Rejected', value: counts.rejected, color: 'bg-red-50' },
          ].map((c) => (
            <div key={c.label} className={`${c.color} border rounded-lg p-4`}>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{c.label}</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 items-center">
          <span className="text-sm text-slate-600">KYC status:</span>
          {['', 'Pending', 'Verified', 'Rejected'].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded text-sm border ${
                statusFilter === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

        {/* Table */}
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
                  <th className="px-4 py-3 font-medium">KYC</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Loading registry…
                    </td>
                  </tr>
                )}
                {!loading && fpos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No FPOs found.
                    </td>
                  </tr>
                )}
                {fpos.map((f) => (
                  <tr key={f._id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{f.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{f.registrationNumber}</td>
                    <td className="px-4 py-3">{f.registrationType || '—'}</td>
                    <td className="px-4 py-3">
                      {[f.contactDetails?.district, f.contactDetails?.state]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">{f.shareholderFarmerCount ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          f.kycStatus === 'Verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : f.kycStatus === 'Rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {f.kycStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      {f.kycStatus !== 'Verified' && (
                        <button
                          onClick={() => setKyc(f._id, 'Verified')}
                          className="text-xs text-emerald-700 hover:underline"
                        >
                          Verify
                        </button>
                      )}
                      {f.kycStatus !== 'Rejected' && (
                        <button
                          onClick={() => setKyc(f._id, 'Rejected')}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Reject
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Read-only compliance view for authority administrators. Farmer PII is not exposed on this
          screen.
        </p>
      </main>
    </div>
  );
}
