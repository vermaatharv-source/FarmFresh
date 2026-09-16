import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

export default function TraceabilityModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [batchInput, setBatchInput] = useState('');
  const [error, setError] = useState('');
  const [popularBatches, setPopularBatches] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Fetch recent public listings with source batches to display as quick-trace samples
  useEffect(() => {
    if (!isOpen) return;
    const fetchSamples = async () => {
      try {
        const res = await API.get('/listings/public?limit=6');
        if (Array.isArray(res.data)) {
          const valid = res.data
            .filter((item) => item.sourceBatch)
            .map((item) => ({
              id: item.sourceBatch._id || item.sourceBatch,
              batchId: item.sourceBatch.batchId || (typeof item.sourceBatch === 'string' ? item.sourceBatch : 'BATCH-PREMIUM'),
              crop: item.produceType,
              fpo: item.fpo?.name || 'Local FPO',
              grade: item.grade || 'A',
            }))
            .slice(0, 4);
          setPopularBatches(valid);
        }
      } catch {
        // Non-critical, fallback to standard samples
      }
    };
    fetchSamples();
  }, [isOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Clean up camera on modal close or unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleClose = () => {
    stopCamera();
    setError('');
    setBatchInput('');
    onClose();
  };

  const startCamera = async () => {
    setError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera access is not supported by your browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);

      // Attempt native BarcodeDetector if available in browser
      if ('BarcodeDetector' in window) {
        // eslint-disable-next-line no-undef
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const interval = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const rawVal = barcodes[0].rawValue;
              clearInterval(interval);
              stopCamera();
              handleTraceUrlOrId(rawVal);
            }
          } catch {
            // Frame detection skipped
          }
        }, 500);
      }
    } catch (_err) {
      setError('Camera permission denied or camera not found. You can enter the Batch ID manually below.');
      setIsCameraActive(false);
    }
  };

  const handleTraceUrlOrId = (val) => {
    let clean = (val || '').trim();
    if (!clean) {
      setError('Please enter a valid Batch ID or Trace URL');
      return;
    }

    // If a full URL was scanned or pasted, extract the batchId suffix
    if (clean.includes('/trace/')) {
      clean = clean.split('/trace/')[1].split('?')[0].split('#')[0];
    }

    handleClose();
    navigate(`/trace/${clean}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleTraceUrlOrId(batchInput);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🌱</span>
            <div>
              <h3 className="font-bold text-base leading-tight">Digital Produce Passport</h3>
              <p className="text-emerald-200 text-xs mt-0.5">Instant Farm-to-Fork Origin & Quality Traceability</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white text-xl font-bold p-1 rounded-lg hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3.5 py-2.5 rounded-lg flex items-start justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="font-bold ml-2">✕</button>
            </div>
          )}

          {/* Camera Scanner Section */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center bg-gray-50/50">
            {isCameraActive ? (
              <div className="relative w-full max-w-xs mx-auto overflow-hidden rounded-xl bg-black aspect-video flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
                <div className="absolute inset-0 border-2 border-emerald-400/80 rounded-xl pointer-events-none animate-pulse"></div>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="absolute bottom-2 bg-black/70 hover:bg-black text-white text-[11px] px-3 py-1 rounded-full backdrop-blur-sm"
                >
                  Stop Camera
                </button>
              </div>
            ) : (
              <div>
                <span className="text-4xl block mb-2">📷</span>
                <p className="text-xs font-semibold text-gray-800">Scan Produce Packaging QR</p>
                <p className="text-[11px] text-gray-500 mt-0.5 max-w-xs mx-auto">
                  Point your device camera at the QR code on your FarmFresh delivery bag or carton
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm inline-flex items-center gap-1.5"
                >
                  <span>📷</span> Open Scanner Camera
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-200 w-full"></div>
            <span className="bg-white px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider absolute">
              Or Enter Manually
            </span>
          </div>

          {/* Manual Input Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Batch ID or QR Passport Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  placeholder="e.g. BATCH-1710600000-123"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-mono text-xs"
                />
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm"
                >
                  Trace →
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Found printed directly below the QR code sticker on the packaging.
              </p>
            </div>
          </form>

          {/* Sample Batches Quick-links */}
          {popularBatches.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Sample Verified Batches
              </p>
              <div className="grid grid-cols-2 gap-2">
                {popularBatches.map((b, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      handleClose();
                      navigate(`/trace/${b.id || b.batchId}`);
                    }}
                    className="p-2 border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 rounded-lg text-left transition group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800 group-hover:text-emerald-800">
                        {b.crop}
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                        Grade {b.grade}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{b.fpo}</p>
                    <p className="text-[9px] font-mono text-emerald-600 mt-0.5">Click to view passport →</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 text-right">
          <button
            onClick={handleClose}
            className="text-xs text-gray-600 hover:text-gray-900 font-medium px-4 py-1.5 rounded-lg hover:bg-gray-200/60 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
