import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useModelContext, DataRow } from '../contexts/ModelContext';
import { useDateContext } from '../contexts/DateContext';
import { exportChart } from '../utils/exportChart';
import './NetworkMST.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MSTNode {
  id: string;
  centrality: number;
  volatility: number | null;
}

interface MSTEdge {
  source: string;
  target: string;
  distance: number;
  correlation: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findRowForDate(rows: DataRow[], date: Date): DataRow | null {
  const target = date.getTime();
  let best: DataRow | null = null;
  for (const r of rows) {
    if (new Date(r.date as string).getTime() <= target) best = r;
  }
  return best;
}

/** Mantegna distance: sqrt(2(1-corr)) */
function mantegnaDistance(corr: number): number {
  return Math.sqrt(2 * Math.max(0, 1 - corr));
}

/**
 * Kruskal's MST on complete graph.
 * edges: list of { i, j, w } sorted by w ascending.
 * Returns list of accepted edge indices.
 */
function kruskalMST(
  n: number,
  edges: Array<{ i: number; j: number; w: number }>
): Array<{ i: number; j: number; w: number }> {
  const parent = Array.from({ length: n }, (_, k) => k);
  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }
  function union(a: number, b: number) {
    parent[find(a)] = find(b);
  }

  const result: Array<{ i: number; j: number; w: number }> = [];
  for (const e of edges) {
    if (find(e.i) !== find(e.j)) {
      result.push(e);
      union(e.i, e.j);
      if (result.length === n - 1) break;
    }
  }
  return result;
}

/**
 * Compute approximate betweenness centrality (BFS-based, unweighted).
 * Returns map from node index to normalized centrality.
 */
function betweennessCentrality(
  n: number,
  adj: boolean[][]
): number[] {
  const bc = Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    const stack: number[] = [];
    const pred: number[][] = Array.from({ length: n }, () => []);
    const sigma = Array(n).fill(0);
    sigma[s] = 1;
    const dist = Array(n).fill(-1);
    dist[s] = 0;
    const queue = [s];
    while (queue.length) {
      const v = queue.shift()!;
      stack.push(v);
      for (let w = 0; w < n; w++) {
        if (!adj[v][w]) continue;
        if (dist[w] < 0) {
          queue.push(w);
          dist[w] = dist[v] + 1;
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          pred[w].push(v);
        }
      }
    }
    const delta = Array(n).fill(0);
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) bc[w] += delta[w];
    }
  }
  const max = Math.max(...bc, 1);
  return bc.map((v) => v / max);
}

// ── Component ─────────────────────────────────────────────────────────────────

const W = 340;
const H = 280;

/**
 * NetworkMST
 *
 * D3 force-directed graph showing the Minimum Spanning Tree of market indices
 * computed using Mantegna distances from the current correlation matrix.
 * Node size ∝ betweenness centrality; node colour ∝ rolling volatility.
 *
 * Requirements: 17.1–17.6, 36.2
 */
const NetworkMST: React.FC = () => {
  const { currentModelData } = useModelContext();
  const { selectedDate } = useDateContext();

  const svgRef = useRef<SVGSVGElement>(null);

  const indices = currentModelData.info.indices;
  const rows = currentModelData.featuresData.data;

  // ── Derive MST graph from current date's correlation matrix ─────────────────
  const { nodes, edges } = useMemo<{ nodes: MSTNode[]; edges: MSTEdge[] }>(() => {
    const row = findRowForDate(rows, selectedDate);
    if (!row) return { nodes: indices.map((id) => ({ id, centrality: 0.5, volatility: null })), edges: [] };

    const pc = (row.pairwise_correlations as Record<string, number | null>) ?? {};

    // Build correlation matrix
    const n = indices.length;
    const corrMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) { corrMatrix[i][j] = 1; continue; }
        const k1 = `${indices[i]}_${indices[j]}`;
        const k2 = `${indices[j]}_${indices[i]}`;
        corrMatrix[i][j] = (pc[k1] ?? pc[k2] ?? 0) as number;
      }
    }

    // All edges sorted by Mantegna distance
    const allEdges: Array<{ i: number; j: number; w: number }> = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        allEdges.push({ i, j, w: mantegnaDistance(corrMatrix[i][j]) });
      }
    }
    allEdges.sort((a, b) => a.w - b.w);

    // MST
    const mstEdges = kruskalMST(n, allEdges);

    // Adjacency for betweenness
    const adj: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
    for (const e of mstEdges) {
      adj[e.i][e.j] = true;
      adj[e.j][e.i] = true;
    }
    const bc = betweennessCentrality(n, adj);

    const nodes: MSTNode[] = indices.map((id, i) => ({
      id,
      centrality: bc[i],
      volatility: (row[id] as number | null) ?? null,
    }));

    const edges: MSTEdge[] = mstEdges.map((e) => ({
      source: indices[e.i],
      target: indices[e.j],
      distance: e.w,
      correlation: corrMatrix[e.i][e.j],
    }));

    return { nodes, edges };
  }, [rows, selectedDate, indices]);

  // ── D3 force simulation ────────────────────────────────────────────────────
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (!nodes.length || !edges.length) return;

    // Volatility color scale
    const volExtent = d3.extent(nodes, (d) => d.volatility ?? 0) as [number, number];
    const volColor = d3.scaleSequential(d3.interpolateYlOrRd).domain(volExtent);

    // Node radius scale
    const rScale = d3.scaleLinear().domain([0, 1]).range([5, 16]);

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('charge', d3.forceManyBody().strength(-90))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force(
        'link',
        d3
          .forceLink(
            edges.map((e) => ({ ...e }))
          )
          .id((d: d3.SimulationNodeDatum) => (d as MSTNode).id)
          .distance((e) => (e as MSTEdge).distance * 80 + 30)
      )
      .force('collision', d3.forceCollide().radius((d) => rScale((d as MSTNode).centrality) + 4));

    // Edge lines
    const link = svg
      .append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', '#ccc')
      .attr('stroke-width', (d) => Math.max(0.5, (1 - d.distance) * 3))
      .attr('stroke-opacity', 0.7);

    // Node circles
    const node = svg
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer');

    node
      .append('circle')
      .attr('r', (d) => rScale(d.centrality))
      .attr('fill', (d) => (d.volatility != null ? volColor(d.volatility) : '#aaa'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    // Labels
    node
      .append('text')
      .attr('dy', (d) => -rScale(d.centrality) - 3)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('font-family', 'var(--font-mono)')
      .attr('fill', 'var(--text-primary)')
      .attr('pointer-events', 'none')
      .text((d) => d.id);

    // Hover title
    node.append('title').text(
      (d) =>
        `${d.id}\nCentrality: ${(d.centrality * 100).toFixed(1)}%\nVol: ${d.volatility?.toFixed(4) ?? '—'}`
    );

    simulation.on('tick', () => {
      type SimNode = d3.SimulationNodeDatum & MSTNode;
      link
        .attr('x1', (d) => ((d.source as unknown) as SimNode).x ?? 0)
        .attr('y1', (d) => ((d.source as unknown) as SimNode).y ?? 0)
        .attr('x2', (d) => ((d.target as unknown) as SimNode).x ?? 0)
        .attr('y2', (d) => ((d.target as unknown) as SimNode).y ?? 0);

      node.attr(
        'transform',
        (d) => `translate(${(d as d3.SimulationNodeDatum).x ?? 0},${(d as d3.SimulationNodeDatum).y ?? 0})`
      );
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges]);

  return (
    <div className="network-mst" id="chart-network-mst" aria-label="Market correlation network MST">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="mst-title">Minimum Spanning Tree</div>
        <button 
          onClick={() => exportChart('chart-network-mst', 'network_mst')}
          style={{ fontSize: '0.75rem', padding: '2px 8px', cursor: 'pointer', marginBottom: '8px' }}
        >
          Export PNG
        </button>
      </div>
      <svg ref={svgRef} width={W} height={H} />
      <div className="mst-legend">
        <span>Low vol</span>
        <div className="mst-vol-bar" />
        <span>High vol</span>
        <span className="mst-legend-sep">·</span>
        <span>Node size = centrality</span>
      </div>
    </div>
  );
};

export default NetworkMST;
