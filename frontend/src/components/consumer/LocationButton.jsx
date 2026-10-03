import { useState } from 'react';
import api from '../../api/axios';

/**
 * Small header button – shares the user's location once so listings can show
 * "x km away". It never hides listings; distance is information only.
 */
export default function LocationButton({ located, onLocationSet }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const detect = () => {
    if (!navigator.geolocation) {
      setMsg('Location not supported');
      return;
    }
    setLoading(true);
    setMsg('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        localStorage.setItem('ff_user_lat', String(lat));
        localStorage.setItem('ff_user_lng', String(lng));
        onLocationSet?.({ lat, lng });
        try {
          await api.put('/growth/me/location', { lat, lng });
        } catch {
          /* saving to profile is optional – distances still work */
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        setMsg(err.code === 1 ? 'Permission denied' : 'Could not get location');
        setTimeout(() => setMsg(''), 3000);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  return (
    <button
      onClick={detect}
      disabled={loading}
      title={located ? 'Location on – tap to refresh' : 'Enable location to see distance of produce'}
      className={`text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border transition disabled:opacity-60 ${
        located
          ? 'bg-emerald-700 text-white border-emerald-700'
          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
      }`}
    >
      <span>📍</span>
      <span className="hidden md:inline">
        {msg || (loading ? 'Detecting…' : located ? 'Near me' : 'Enable location')}
      </span>
    </button>
  );
}
