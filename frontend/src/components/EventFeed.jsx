import React from 'react';
import { Bell, AlertTriangle, AlertCircle, Info, Clock, Layers } from 'lucide-react';

export default function EventFeed({ eventsData, onSelectNode }) {
  const events = eventsData?.events || [];

  if (events.length === 0) {
    return (
      <div className="state-container">
        <Bell size={28} style={{ color: '#64748b' }} />
        <span style={{ fontSize: '0.8rem' }}>No recent operational events logged.</span>
      </div>
    );
  }

  const formatTimestamp = (isoStr) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) {
      return isoStr;
    }
  };

  return (
    <div className="event-feed-list">
      {events.map((evt) => {
        const severity = evt.severity || 'info';

        return (
          <div
            key={evt.id}
            className={`event-card ${severity}`}
            onClick={() => evt.node_id && evt.node_id !== 'system' && onSelectNode(evt.node_id)}
            style={{ cursor: evt.node_id && evt.node_id !== 'system' ? 'pointer' : 'default' }}
          >
            <div className="event-meta">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {severity === 'critical' && <AlertCircle size={14} style={{ color: '#ef4444' }} />}
                {severity === 'warning' && <AlertTriangle size={14} style={{ color: '#f59e0b' }} />}
                {severity === 'info' && <Info size={14} style={{ color: '#38bdf8' }} />}

                <span style={{ fontWeight: 700, color: '#fff' }}>
                  {evt.node_name}
                </span>

                <span style={{
                  fontSize: '0.62rem',
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#94a3b8'
                }}>
                  {evt.event_type}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {evt.cascade_depth > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#f59e0b', fontSize: '0.62rem' }}>
                    <Layers size={11} /> Hop {evt.cascade_depth}
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#64748b' }}>
                  <Clock size={11} /> {formatTimestamp(evt.timestamp)}
                </span>
              </div>
            </div>

            <div className="event-message">
              {evt.message}
            </div>
          </div>
        );
      })}
    </div>
  );
}
