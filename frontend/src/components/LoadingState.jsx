import React from 'react';

export default function LoadingState({ message = 'Loading infrastructure topology & risk calculations...' }) {
  return (
    <div className="state-container" style={{ minHeight: 400 }}>
      <div className="spinner" style={{ width: 44, height: 44, borderWidth: 4 }}></div>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', marginTop: '0.5rem' }}>
        SENTINEL Z Command Engine
      </div>
      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
        {message}
      </div>
    </div>
  );
}
