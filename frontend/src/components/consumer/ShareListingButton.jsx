import React, { useState } from 'react';
import api from '../../api/axios';

/**
 * Share listing via WhatsApp / native share / copy link
 */
export default function ShareListingButton({ listingId, produceType, pricePerKg, className = '' }) {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/growth/share/listing/${listingId}`);
      const { shareUrl, whatsappLink } = res.data.data;

      // Prefer native Web Share API
      if (navigator.share) {
        await navigator.share({
          title: `Fresh ${produceType} on FarmFresh`,
          text: `Grade produce at ₹${pricePerKg}/kg – farm to table`,
          url: shareUrl,
        });
      } else {
        // Fallback: open WhatsApp
        window.open(whatsappLink, '_blank');
      }
    } catch (err) {
      // User cancelled share is fine
      if (err.name !== 'AbortError') {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-60 ${className}`}
      title="Share this produce"
      aria-label="Share this produce"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      <span className="sr-only">Share</span>
    </button>
  );
}
