import React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

export default function ErrorState({ error, onRetry }) {
  return (
    <div className="state-container" style={{ minHeight: 400, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
      <AlertOctagon size={44} style={{ color: '#ef4444' }} />
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
        Backend Connection Interrupted
      </div>
      <div style={{ fontSize: '0.8rem', color: '#fca5a5', maxWidth: 480 }}>
        {error || 'Unable to communicate with the SENTINEL Z FastAPI service at the configured endpoint.'}
      </div>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry} style={{ marginTop: '0.8rem' }}>
          <RefreshCw size={14} />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
}
