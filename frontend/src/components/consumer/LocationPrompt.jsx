import React, { useState } from 'react';
import api from '../../api/axios';

/**
 * Ask user for location once – critical for geo discovery
 */
export default function LocationPrompt({ onLocationSet }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(
    localStorage.getItem('ff_location_dismissed') === '1'
  );

  if (dismissed) return null;

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device');
      return;
    }
    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { longitude: lng, latitude: lat } = pos.coords;
          await api.put('/growth/me/location', { lng, lat });
          localStorage.setItem('ff_user_lat', lat);
          localStorage.setItem('ff_user_lng', lng);
          onLocationSet?.({ lat, lng });
          setDismissed(true);
        } catch (e) {
          setError('Failed to save location');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        setError(
          err.code === 1
            ? 'Location permission denied. You can still browse all produce.'
            : 'Could not get location'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const dismiss = () => {
    localStorage.setItem('ff_location_dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex-1">
        <h4 className="font-semibold text-amber-900">See produce near you</h4>
        <p className="text-sm text-amber-700 mt-0.5">
          Enable location to discover farm-fresh items within delivery distance and get faster delivery estimates.
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={dismiss}
          className="px-3 py-2 text-sm text-amber-700 hover:bg-amber-100 rounded-lg"
        >
          Later
        </button>
        <button
          onClick={requestLocation}
          disabled={loading}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60"
        >
          {loading ? 'Detecting…' : 'Enable Location'}
        </button>
      </div>
    </div>
  );
}
