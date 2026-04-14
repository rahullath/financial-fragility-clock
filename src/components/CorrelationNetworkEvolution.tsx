import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useModelContext } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { exportChart } from '../utils/exportChart';
import { generateCorrelationNetworkExplanation } from '../utils/laymanExplanations';
import LaymanOverlay from './LaymanOverlay';
import type { NetworkSnapshot } from '../types';
import './CorrelationNetworkEvolution.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_NODES = 50; // Performance limit
const WEAK_EDGE_THRESHOLD = 0.3; // Filter edges below this correlation
const CRISIS_DENSITY_THRESHOLD = 0.6; // Network density indicating crisis pattern
const CRISIS_CLUSTERING_THRESHOLD = 0.7; // Clustering coefficient indicating crisis

// ── Types ─────────────────────────────────────────────────────────────────────

interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  degree: number;
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  source: string | SimulationNode;
  target: string | SimulationNode;
  weight: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * CorrelationNetworkEvolution
 *
 * Displays an animated force-directed graph showing how correlation networks
 * evolve over time. Includes animation controls, network metrics, and highlights
 * crisis-like patterns.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
const CorrelationNetworkEvolution: React.FC = () => {
  const { getNetworkSnapshot, correlationNetworks } = useModelContext();
  const { selectedDate } = useDateContext();
  
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimulationNode, SimulationLink> | null>(null);
  
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1000); // ms per frame
  const [currentSnapshotIndex, setCurrentSnapshotIndex] = useState(0);
  const animationTimerRef = useRef<number | null>(null);

  // Get all snapshots for animation
  const snapshots = correlationNetworks?.snapshots || [];
  
  // Get current snapshot based on selected date or animation index
  const currentSnapshot = useMemo(() => {
    if (isAnimating && snapshots.length > 0) {
      return snapshots[currentSnapshotIndex];
    }
    
    const dateStr = selectedDate.toISOString().split('T')[0];
    return getNetworkSnapshot(dateStr);
  }, [selectedDate, getNetworkSnapshot, isAnimating, currentSnapshotIndex, snapshots]);

  // Process snapshot data with performance optimizations
  const processedData = useMemo(() => {
    if (!currentSnapshot) return null;

    // Limit nodes for performance
    const nodes = currentSnapshot.nodes.slice(0, MAX_NODES);
    
    // Filter weak edges and ensure both source and target are in node list
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = currentSnapshot.edges.filter(
      e => e.weight >= WEAK_EDGE_THRESHOLD && 
           nodeIds.has(e.source) && 
           nodeIds.has(e.target)
    );

    // Calculate node degrees
    const degreeMap = new Map<string, number>();
    edges.forEach(edge => {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
    });

    const processedNodes: SimulationNode[] = nodes.map(node => ({
      id: node.id,
      label: node.label,
      degree: degreeMap.get(node.id) || 0,
    }));

    const processedLinks: SimulationLink[] = edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
    }));

    return { nodes: processedNodes, links: processedLinks };
  }, [currentSnapshot]);

  // Check if current network shows crisis-like pattern
  const isCrisisPattern = useMemo(() => {
    if (!currentSnapshot) return false;
    const { density, clustering_coefficient } = currentSnapshot.metrics;
    return density >= CRISIS_DENSITY_THRESHOLD || 
           clustering_coefficient >= CRISIS_CLUSTERING_THRESHOLD;
  }, [currentSnapshot]);

  // Animation control
  useEffect(() => {
    if (isAnimating && snapshots.length > 0) {
      animationTimerRef.current = window.setInterval(() => {
        setCurrentSnapshotIndex(prev => {
          const next = prev + 1;
          if (next >= snapshots.length) {
            setIsAnimating(false);
            return 0;
          }
          return next;
        });
      }, animationSpeed);
    }

    return () => {
      if (animationTimerRef.current) {
        clearInterval(animationTimerRef.current);
      }
    };
  }, [isAnimating, animationSpeed, snapshots.length]);

  // D3 force simulation
  useEffect(() => {
    if (!svgRef.current || !processedData) return;

    const svg = d3.select(svgRef.current);
    const width = 600;
    const height = 500;

    // Clear previous content
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create force simulation
    const simulation = d3.forceSimulation<SimulationNode>(processedData.nodes)
      .force('link', d3.forceLink<SimulationNode, SimulationLink>(processedData.links)
        .id(d => d.id)
        .distance(d => 100 / (d.weight + 0.1)) // Stronger correlations = closer nodes
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    simulationRef.current = simulation;

    // Draw links
    const link = g.append('g')
      .selectAll('line')
      .data(processedData.links)
      .join('line')
      .attr('class', 'network-link')
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-opacity', d => d.weight * 0.6)
      .attr('stroke-width', d => Math.max(1, d.weight * 4));

    // Draw nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(processedData.nodes)
      .join('circle')
      .attr('class', 'network-node')
      .attr('r', d => Math.max(5, Math.sqrt(d.degree) * 3))
      .attr('fill', d => {
        if (isCrisisPattern) return 'var(--ponzi)';
        if (d.degree > 10) return 'var(--speculative)';
        return 'var(--hedge)';
      })
      .attr('stroke', 'var(--bg-primary)')
      .attr('stroke-width', 2)
      .call(d3.drag<SVGCircleElement, SimulationNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Add labels for high-degree nodes
    const label = g.append('g')
      .selectAll('text')
      .data(processedData.nodes.filter(d => d.degree > 5))
      .join('text')
      .attr('class', 'network-label')
      .attr('text-anchor', 'middle')
      .attr('dy', -15)
      .attr('font-size', 10)
      .attr('fill', 'var(--text-secondary)')
      .attr('font-family', 'var(--font-mono)')
      .text(d => d.label);

    // Tooltips
    node.append('title')
      .text(d => `${d.label}\nDegree: ${d.degree}`);

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimulationNode).x!)
        .attr('y1', d => (d.source as SimulationNode).y!)
        .attr('x2', d => (d.target as SimulationNode).x!)
        .attr('y2', d => (d.target as SimulationNode).y!);

      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);

      label
        .attr('x', d => d.x!)
        .attr('y', d => d.y!);
    });

    return () => {
      simulation.stop();
    };
  }, [processedData, isCrisisPattern]);

  // Animation controls
  const handleToggleAnimation = () => {
    if (isAnimating) {
      setIsAnimating(false);
    } else {
      setCurrentSnapshotIndex(0);
      setIsAnimating(true);
    }
  };

  const handleSpeedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAnimationSpeed(Number(event.target.value));
  };

  if (!currentSnapshot) {
    return (
      <div className="correlation-network-evolution">
        <div className="cne-header">
          <div className="cne-title">Correlation Network Evolution</div>
        </div>
        <div className="cne-no-data">
          No network data available for the selected date.
        </div>
      </div>
    );
  }

  const { metrics } = currentSnapshot;

  return (
    <div 
      className="correlation-network-evolution"
      id="chart-correlation-network"
      aria-label="Correlation network evolution visualization"
    >
      <div className="cne-header">
        <div className="cne-title">Correlation Network Evolution</div>
        <div className="cne-controls">
          <LaymanOverlay 
            explanationGenerator={() => 
              generateCorrelationNetworkExplanation(currentSnapshot, isCrisisPattern)
            }
          />
          <button 
            onClick={() => exportChart('chart-correlation-network', 'correlation_network')}
            className="cne-export-btn"
          >
            Export PNG
          </button>
        </div>
      </div>

      {isCrisisPattern && (
        <div className="cne-crisis-alert">
          ⚠️ Crisis-like network pattern detected
        </div>
      )}

      <div className="cne-content">
        <div className="cne-graph-container">
          <svg 
            ref={svgRef} 
            width={600} 
            height={500}
            className="cne-svg"
          />
        </div>

        <div className="cne-sidebar">
          {/* Network Metrics Panel */}
          <div className="cne-metrics-panel">
            <h3>Network Metrics</h3>
            <div className="cne-metric">
              <span className="cne-metric-label">Density:</span>
              <span className="cne-metric-value">
                {(metrics.density * 100).toFixed(1)}%
              </span>
            </div>
            <div className="cne-metric">
              <span className="cne-metric-label">Clustering:</span>
              <span className="cne-metric-value">
                {(metrics.clustering_coefficient * 100).toFixed(1)}%
              </span>
            </div>
            <div className="cne-metric">
              <span className="cne-metric-label">Avg Degree:</span>
              <span className="cne-metric-value">
                {metrics.avg_degree.toFixed(1)}
              </span>
            </div>
            <div className="cne-metric">
              <span className="cne-metric-label">Nodes:</span>
              <span className="cne-metric-value">
                {processedData?.nodes.length || 0}
              </span>
            </div>
            <div className="cne-metric">
              <span className="cne-metric-label">Edges:</span>
              <span className="cne-metric-value">
                {processedData?.links.length || 0}
              </span>
            </div>
          </div>

          {/* Animation Controls */}
          <div className="cne-animation-panel">
            <h3>Animation</h3>
            <button 
              onClick={handleToggleAnimation}
              className="cne-animation-btn"
              disabled={snapshots.length === 0}
            >
              {isAnimating ? '⏸ Pause' : '▶ Play'}
            </button>
            
            <div className="cne-speed-control">
              <label htmlFor="animation-speed">Speed:</label>
              <input
                id="animation-speed"
                type="range"
                min="200"
                max="2000"
                step="200"
                value={animationSpeed}
                onChange={handleSpeedChange}
                disabled={isAnimating}
              />
              <span>{(animationSpeed / 1000).toFixed(1)}s</span>
            </div>

            {isAnimating && (
              <div className="cne-progress">
                Frame {currentSnapshotIndex + 1} / {snapshots.length}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="cne-legend">
            <h3>Legend</h3>
            <div className="cne-legend-item">
              <div className="cne-legend-circle" style={{ backgroundColor: 'var(--hedge)' }} />
              <span>Normal connectivity</span>
            </div>
            <div className="cne-legend-item">
              <div className="cne-legend-circle" style={{ backgroundColor: 'var(--speculative)' }} />
              <span>High connectivity</span>
            </div>
            <div className="cne-legend-item">
              <div className="cne-legend-circle" style={{ backgroundColor: 'var(--ponzi)' }} />
              <span>Crisis pattern</span>
            </div>
            <div className="cne-legend-note">
              Node size = degree (connections)<br />
              Edge thickness = correlation strength<br />
              Drag nodes to reposition
            </div>
          </div>
        </div>
      </div>

      <div className="cne-date-display">
        {currentSnapshot.date}
      </div>
    </div>
  );
};

export default CorrelationNetworkEvolution;
