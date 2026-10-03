import { useState } from 'react';
import API from '../../api/axios';

/**
 * FPO sets where its produce is dispatched from, plus the usual delivery radius.
 * Buyers then see "x km away" on every listing from this FPO.
 */
export default function FpoLocationCard({ profile, onSaved }) {
  const saved = profile?.geoLocation?.coordinates;
  const hasSaved = Array.isArray(saved) && saved.length === 2;
  const [radius, setRadius] = useState(profile?.defaultDeliveryRadiusKm || 30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const save = (lat, lng) =>
    API.put('/growth/fpo/location', { lat, lng, deliveryRadiusKm: Number(radius) || 30 }).then((res) => {
      const n = res.data?.data?.listingsUpdated || 0;
      setMsg({
        type: 'ok',
        text: `Location saved.${n ? ` ${n} listing${n === 1 ? '' : 's'} updated.` : ''}`,
      });
      onSaved?.();
    });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMsg({ type: 'err', text: 'This browser cannot share location.' });
      return;
    }
    setBusy(true);
    setMsg({ type: '', text: '' });
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await save(coords.latitude, coords.longitude);
        } catch (e) {
          setMsg({ type: 'err', text: e.response?.data?.message || 'Could not save location.' });
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        setBusy(false);
        setMsg({
          type: 'err',
          text: err.code === 1 ? 'Location permission was denied. Allow it in the browser and try again.' : 'Could not read your location.',
        });
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const saveRadiusOnly = async () => {
    if (!hasSaved) return;
    setBusy(true);
    try {
      await save(saved[1], saved[0]);
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.message || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="font-bold text-slate-900 text-base">Dispatch location and delivery area</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Buyers see how far your produce is from them. Without a saved location, your listings show no distance.
        </p>
      </div>

      <p className="text-sm">
        {hasSaved ? (
          <span className="text-emerald-700 font-semibold">
            Location saved ({saved[1].toFixed(4)}, {saved[0].toFixed(4)})
          </span>
        ) : (
          <span className="text-amber-700 font-semibold">No location saved yet</span>
        )}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          Usual delivery radius (km)
          <input
            type="number"
            min="1"
            max="200"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="block mt-1 w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-600"
          />
        </label>
        <button
          onClick={useMyLocation}
          disabled={busy}
          className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 transition"
        >
          {busy ? 'Saving…' : hasSaved ? 'Update to my current location' : 'Use my current location'}
        </button>
        {hasSaved && (
          <button
            onClick={saveRadiusOnly}
            disabled={busy}
            className="border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 transition"
          >
            Save radius only
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        Open this page from the place you dispatch from (warehouse or collection centre), then tap the button.
      </p>

      {msg.text && (
        <p className={`text-xs rounded-lg px-3 py-2 border ${msg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
