import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CustomNode from './CustomNode';
import { Maximize2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

const nodeTypes = {
  custom: CustomNode,
};

const EDGE_COLORS = {
  power: '#38bdf8',
  telecom: '#a855f7',
  operational: '#6366f1',
  water: '#06b6d4',
};

// Sector fallback coordinate mapping if coordinates metadata is ever absent
const SECTOR_COORDS = {
  substation: { x: 100, y: 140 },
  transformer: { x: 300, y: 120 },
  hospital: { x: 540, y: 100 },
  communication_hub: { x: 540, y: 420 },
  traffic_system: { x: 780, y: 120 },
  emergency_facility: { x: 780, y: 460 },
};

export default function InfrastructureGraph({
  infrastructure,
  risksData,
  selectedNodeId,
  onSelectNode,
  loading = false,
  error = null,
  onRetry = null,
}) {
  const [rfInstance, setRfInstance] = useState(null);
  const initialFittedRef = useRef(false);

  // Build lookup map for node risks
  const riskMap = useMemo(() => {
    const map = new Map();
    (risksData?.risks || []).forEach((r) => map.set(r.node_id, r));
    return map;
  }, [risksData]);

  // Construct React Flow Nodes
  const rfNodes = useMemo(() => {
    if (!infrastructure?.nodes || !Array.isArray(infrastructure.nodes)) return [];

    return infrastructure.nodes.map((node) => {
      const risk = riskMap.get(node.id);
      const fallback = SECTOR_COORDS[node.type] || { x: 200, y: 200 };
      const coords = node.metadata?.coordinates || fallback;

      return {
        id: node.id,
        type: 'custom',
        position: { x: Number(coords.x), y: Number(coords.y) },
        data: {
          node,
          risk,
          onSelect: () => onSelectNode(node.id),
        },
        selected: node.id === selectedNodeId,
      };
    });
  }, [infrastructure, riskMap, selectedNodeId]);

  // Construct React Flow Directional Edges
  const rfEdges = useMemo(() => {
    if (!infrastructure?.edges || !Array.isArray(infrastructure.edges)) return [];

    return infrastructure.edges.map((edge) => {
      const sourceRisk = riskMap.get(edge.source);
      const targetRisk = riskMap.get(edge.target);

      // Edge is highlighted/stressed if source is abnormal or target is receiving cascade stress
      const isSourceStressed = sourceRisk && sourceRisk.status !== 'nominal';
      const isTargetCascade = targetRisk && (targetRisk.cascade_risk > 0.20 || (targetRisk.impacted_by && targetRisk.impacted_by.includes(edge.source)));
      const isStressed = Boolean(isSourceStressed || isTargetCascade);

      const baseColor = isStressed ? '#ef4444' : (EDGE_COLORS[edge.dependency_type] || '#64748b');

      return {
        id: `e-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated: isStressed,
        style: {
          stroke: baseColor,
          strokeWidth: isStressed ? 2.5 : 1.5,
          opacity: 0.88,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: baseColor,
          width: 14,
          height: 14,
        },
        label: `${edge.dependency_type}`,
        labelStyle: { fill: '#cbd5e1', fontSize: 10, fontWeight: 600, letterSpacing: '0.02em' },
        labelBgStyle: { fill: '#0a0f1d', fillOpacity: 0.9, rx: 4, ry: 4 },
        labelBgPadding: [4, 2],
      };
    });
  }, [infrastructure, riskMap]);

  // Auto-fit view when graph data is loaded and canvas is ready
  useEffect(() => {
    if (rfInstance && rfNodes.length > 0 && !initialFittedRef.current) {
      initialFittedRef.current = true;
      const timer = setTimeout(() => {
        rfInstance.fitView({ padding: 0.16, duration: 400 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [rfInstance, rfNodes.length]);

  const handleFitView = useCallback(() => {
    if (rfInstance) {
      rfInstance.fitView({ padding: 0.16, duration: 400 });
    }
  }, [rfInstance]);

  const handleNodeClick = useCallback((_, node) => {
    onSelectNode(node.id);
  }, [onSelectNode]);

  const handlePaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  return (
    <div className="panel graph-panel" id="crisisgraph-container">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-title">CrisisGraph Infrastructure Topology</span>
          <span className="panel-badge">{rfNodes.length} Nodes</span>
          <span className="panel-badge">{rfEdges.length} Dependency Edges</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.05)' }}
            onClick={handleFitView}
            title="Center and fit all 16 infrastructure nodes in view"
          >
            <Maximize2 size={12} />
            <span>Fit View</span>
          </button>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Click node to inspect cascade path
          </span>
        </div>
      </div>

      {/* Sector Stage Header Overlay */}
      <div className="sector-header-bar">
        <div className="sector-stage-col" style={{ left: '6%' }}>
          <span className="stage-num">01</span> Power Grid (500kV / 230kV)
        </div>
        <div className="sector-stage-col" style={{ left: '26%' }}>
          <span className="stage-num">02</span> Sub-Transmission &amp; Transformers
        </div>
        <div className="sector-stage-col" style={{ left: '48%' }}>
          <span className="stage-num">03</span> Healthcare &amp; Telecom Hubs
        </div>
        <div className="sector-stage-col" style={{ left: '72%' }}>
          <span className="stage-num">04</span> Civic Dispatch &amp; Regional Grids
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        className="react-flow-wrapper"
        style={{ width: '100%', height: '620px', minHeight: '600px', position: 'relative' }}
      >
        {loading && !infrastructure ? (
          <div className="graph-state-overlay">
            <Loader2 size={32} className="spinner" style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: 12 }}>
              Loading CrisisGraph Infrastructure Topology...
            </span>
          </div>
        ) : error && !infrastructure ? (
          <div className="graph-state-overlay error">
            <AlertCircle size={36} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginTop: 10 }}>
              Failed to load infrastructure topology
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: 360, textAlign: 'center', marginTop: 4 }}>
              {error}
            </span>
            {onRetry && (
              <button className="btn btn-primary" onClick={onRetry} style={{ marginTop: 12 }}>
                <RefreshCw size={14} />
                <span>Retry Connection</span>
              </button>
            )}
          </div>
        ) : (
          <ReactFlow
            key={rfNodes.length > 0 ? 'graph-loaded' : 'graph-init'}
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onInit={setRfInstance}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            minZoom={0.25}
            maxZoom={1.8}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(255, 255, 255, 0.05)" gap={24} size={1} />
            <Controls
              position="top-right"
              showInteractive={false}
              style={{
                background: '#0d1322',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            />
            <MiniMap
              position="bottom-right"
              nodeColor={(n) => {
                const risk = riskMap.get(n.id);
                if (risk?.status === 'critical') return '#ef4444';
                if (risk?.status === 'warning') return '#f59e0b';
                if (risk?.cascade_risk > 0.20) return '#f97316';
                return '#10b981';
              }}
              maskColor="rgba(7, 10, 19, 0.85)"
              style={{
                background: '#0d1322',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                width: 140,
                height: 90,
              }}
            />
          </ReactFlow>
        )}

        {/* Legend */}
        <div className="graph-legend">
          <span className="legend-title">Operational Risk States</span>
          <div className="legend-row">
            <div className="legend-item">
              <span className="legend-color" style={{ background: '#10b981' }}></span>
              <span>Nominal</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ background: '#f59e0b' }}></span>
              <span>Warning</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ background: '#ef4444' }}></span>
              <span>Critical</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ background: '#f97316', border: '1px dashed #fff' }}></span>
              <span>Cascade</span>
            </div>
          </div>
          <span className="legend-title" style={{ marginTop: '0.2rem' }}>Coupling Channels</span>
          <div className="legend-row">
            <div className="legend-item">
              <span className="legend-color" style={{ background: EDGE_COLORS.power }}></span>
              <span>Power</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ background: EDGE_COLORS.telecom }}></span>
              <span>Telecom</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ background: EDGE_COLORS.operational }}></span>
              <span>Ops</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ background: EDGE_COLORS.water }}></span>
              <span>Water</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
