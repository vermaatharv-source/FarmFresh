import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../api/axios';
import BrandLogo from '../components/BrandLogo';

export default function TraceabilityPassport() {
  const { batchId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTraceability = async () => {
      try {
        const res = await API.get(`/fpo/trace/${batchId}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load batch passport data.');
      } finally {
        setLoading(false);
      }
    };

    if (batchId) {
      fetchTraceability();
    }
  }, [batchId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 font-medium animate-pulse">Loading Digital Produce Passport...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center max-w-md w-full">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Passport Not Found</h2>
          <p className="text-gray-500 text-sm mb-6">{error || 'Invalid or missing Batch ID.'}</p>
          <Link to="/" className="inline-block bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 transition">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-emerald-50/50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-700 text-white p-6 text-center">
          <span className="text-xs uppercase font-bold tracking-widest bg-emerald-800 text-emerald-200 px-3 py-1 rounded-full">
            Verified Traceability Record
          </span>
          <h1 className="text-2xl font-extrabold mt-3">{data.title}</h1>
          <p className="text-emerald-100 text-sm mt-1">Batch ID: <span className="font-mono text-yellow-300 font-bold">{data.batchId}</span></p>
        </div>

        <div className="p-6 space-y-6">
          {/* Section 1: Produce Summary */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
            <div>
              <p className="text-xs text-emerald-700 font-semibold uppercase">Produce</p>
              <p className="text-xl font-bold text-gray-900">{data.produceType}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-emerald-700 font-semibold uppercase">Raw Intake Weight</p>
              <p className="text-xl font-bold text-gray-900">{data.intake?.rawQuantityKg} kg</p>
            </div>
          </div>

          {/* Section 2: Origin & FPO */}
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Farmer Information</p>
              <p className="font-bold text-gray-800">{data.farmer?.name}</p>
              <p className="text-sm text-gray-600">{data.farmer?.region || 'Location Not Specified'}</p>
            </div>
          </div>

          {/* Section 3: Timeline & Collection */}
          <div className="p-4 border border-gray-100 rounded-xl bg-gray-50/50 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Harvest & Collection</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Harvest Date:</span>
              <span className="font-semibold text-gray-800">
                {data.intake?.harvestDate ? new Date(data.intake.harvestDate).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Intake Logging Date:</span>
              <span className="font-semibold text-gray-800">
                {data.intake?.collectionDate ? new Date(data.intake.collectionDate).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* Section 4: Grading Breakdown */}
          {data.qualityAndGrading && (
            <div className="p-4 border border-gray-100 rounded-xl bg-gray-50/50">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase">Quality Assessment</p>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Status: {data.qualityAndGrading.status || 'Pending'}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-3">
                Quality Score: <span className="font-bold text-gray-900">{data.qualityAndGrading.qualityScore || 'N/A'} / 10</span>
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="p-2 bg-emerald-100/50 rounded-lg">
                  <p className="text-xs text-emerald-800 font-semibold">Grade A</p>
                  <p className="font-bold">{data.qualityAndGrading.gradeA_Kg || 0} kg</p>
                </div>
                <div className="p-2 bg-yellow-100/50 rounded-lg">
                  <p className="text-xs text-yellow-800 font-semibold">Grade B</p>
                  <p className="font-bold">{data.qualityAndGrading.gradeB_Kg || 0} kg</p>
                </div>
                <div className="p-2 bg-orange-100/50 rounded-lg">
                  <p className="text-xs text-orange-800 font-semibold">Grade C</p>
                  <p className="font-bold">{data.qualityAndGrading.gradeC_Kg || 0} kg</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer badge */}
          <div className="text-center pt-2">
            <div className="flex flex-col items-center gap-2">
              <BrandLogo size="sm" className="opacity-80" />
              <p className="text-xs text-gray-400">Powered by FarmFresh Traceability Engine</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}