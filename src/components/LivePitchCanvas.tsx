import React, { useEffect, useRef, useState } from 'react';

export interface PlayerNode {
  track_id: number;
  jersey: number;
  team: 'HOME' | 'AWAY';
  x: number;
  y: number;
  speed_kmh: number;
}

export interface PassingNetworkData {
  nodes: { track_id: number; jersey: number; avg_x: number; avg_y: number; pass_count: number }[];
  edges: { source: number; target: number; weight: number }[];
  team_convex_hull_area_m2: number;
}

interface LivePitchCanvasProps {
  players: PlayerNode[];
  ball: { x: number; y: number };
  overlayMode: 'LIVE_TRACKING' | 'HEATMAP' | 'PASSING_NETWORK' | 'PRESSURE_MAP';
  heatmapGrid?: number[][];
  passingNetwork?: PassingNetworkData;
  pressureGrid?: number[][];
  onPlayerClick?: (player: PlayerNode) => void;
}

export const LivePitchCanvas: React.FC<LivePitchCanvasProps> = ({
  players,
  ball,
  overlayMode,
  heatmapGrid,
  passingNetwork,
  pressureGrid,
  onPlayerClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredPlayer, setHoveredPlayer] = useState<PlayerNode | null>(null);

  // Pitch standard: 105m x 68m -> Canvas: 735px x 476px (scale = 7px per meter)
  const WIDTH = 735;
  const HEIGHT = 476;
  const SCALE = 7;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw Tactical Grass Pitch with Subtle Striping
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Mowing stripes
    const stripeWidth = WIDTH / 10;
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(i * stripeWidth, 0, stripeWidth, HEIGHT);
      }
    }

    // Outer boundary & Pitch lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, WIDTH - 28, HEIGHT - 28);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 14);
    ctx.lineTo(WIDTH / 2, HEIGHT - 14);
    ctx.stroke();

    // Center circle (radius 9.15m)
    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT / 2, 9.15 * SCALE, 0, Math.PI * 2);
    ctx.stroke();

    // Center spot
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(WIDTH / 2, HEIGHT / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Left Penalty Box (16.5m deep, 40.3m wide)
    const penW = 16.5 * SCALE;
    const penH = 40.3 * SCALE;
    const penY = (HEIGHT - penH) / 2;
    ctx.strokeRect(14, penY, penW, penH);

    // Left Goal Area (5.5m deep, 18.32m wide)
    const goalBoxW = 5.5 * SCALE;
    const goalBoxH = 18.32 * SCALE;
    const goalBoxY = (HEIGHT - goalBoxH) / 2;
    ctx.strokeRect(14, goalBoxY, goalBoxW, goalBoxH);

    // Left Penalty Spot (11m out)
    ctx.beginPath();
    ctx.arc(14 + 11 * SCALE, HEIGHT / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Right Penalty Box
    ctx.strokeRect(WIDTH - 14 - penW, penY, penW, penH);

    // Right Goal Area
    ctx.strokeRect(WIDTH - 14 - goalBoxW, goalBoxY, goalBoxW, goalBoxH);

    // Right Penalty Spot
    ctx.beginPath();
    ctx.arc(WIDTH - 14 - 11 * SCALE, HEIGHT / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 2. Heatmap Overlay
    if (overlayMode === 'HEATMAP' && heatmapGrid && heatmapGrid.length > 0) {
      const rows = heatmapGrid.length;
      const cols = heatmapGrid[0].length;
      const cellW = (WIDTH - 28) / cols;
      const cellH = (HEIGHT - 28) / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const val = heatmapGrid[r][c];
          if (val > 0.08) {
            // Gradient from yellow to intense red
            const alpha = Math.min(0.85, val * 0.95);
            if (val > 0.6) {
              ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
            } else if (val > 0.3) {
              ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`;
            } else {
              ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 0.7})`;
            }
            ctx.fillRect(14 + c * cellW, 14 + r * cellH, cellW + 0.5, cellH + 0.5);
          }
        }
      }
    }

    // 3. Pressure Map Overlay
    if (overlayMode === 'PRESSURE_MAP' && pressureGrid && pressureGrid.length > 0) {
      const rows = pressureGrid.length;
      const cols = pressureGrid[0].length;
      const cellW = (WIDTH - 28) / cols;
      const cellH = (HEIGHT - 28) / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const intensity = pressureGrid[r][c];
          if (intensity > 0.12) {
            ctx.fillStyle = `rgba(244, 63, 94, ${intensity * 0.75})`;
            ctx.fillRect(14 + c * cellW, 14 + r * cellH, cellW, cellH);
          }
        }
      }
    }

    // 4. Passing Network Overlay
    if (overlayMode === 'PASSING_NETWORK' && passingNetwork) {
      // Draw Team Convex Hull
      if (passingNetwork.nodes.length >= 3) {
        ctx.beginPath();
        const first = passingNetwork.nodes[0];
        ctx.moveTo(14 + first.avg_x * SCALE, 14 + first.avg_y * SCALE);
        for (let i = 1; i < passingNetwork.nodes.length; i++) {
          const n = passingNetwork.nodes[i];
          ctx.lineTo(14 + n.avg_x * SCALE, 14 + n.avg_y * SCALE);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const nodeMap = new Map(passingNetwork.nodes.map((n) => [n.track_id, n]));

      // Draw Edges with arrow / thickness
      passingNetwork.edges.forEach((edge) => {
        const src = nodeMap.get(edge.source);
        const dst = nodeMap.get(edge.target);
        if (src && dst) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
          ctx.lineWidth = Math.min(7, Math.max(1.8, edge.weight * 0.35));
          ctx.moveTo(14 + src.avg_x * SCALE, 14 + src.avg_y * SCALE);
          ctx.lineTo(14 + dst.avg_x * SCALE, 14 + dst.avg_y * SCALE);
          ctx.stroke();
        }
      });

      // Draw Nodes
      passingNetwork.nodes.forEach((node) => {
        const radius = Math.min(18, Math.max(9, 7 + node.pass_count * 0.25));
        const px = 14 + node.avg_x * SCALE;
        const py = 14 + node.avg_y * SCALE;

        ctx.beginPath();
        ctx.fillStyle = '#0284c7';
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px JetBrains Mono, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(node.jersey), px, py);
      });
      return;
    }

    // 5. Draw Live Players and Ball
    players.forEach((p) => {
      const px = 14 + p.x * SCALE;
      const py = 14 + p.y * SCALE;
      const isHome = p.team === 'HOME';

      // Velocity trace / direction indicator
      if (p.speed_kmh > 15) {
        ctx.beginPath();
        ctx.strokeStyle = isHome ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)';
        ctx.lineWidth = 3;
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.fillStyle = isHome ? '#ef4444' : '#3b82f6';
      ctx.arc(px, py, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px JetBrains Mono, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.jersey), px, py);
    });

    // Draw Ball with glow
    const bx = 14 + ball.x * SCALE;
    const by = 14 + ball.y * SCALE;

    // Outer glow
    ctx.beginPath();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.arc(bx, by, 10, 0, Math.PI * 2);
    ctx.fill();

    // Ball center
    ctx.beginPath();
    ctx.fillStyle = '#facc15';
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [players, ball, overlayMode, heatmapGrid, passingNetwork, pressureGrid]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let found: PlayerNode | null = null;
    for (const p of players) {
      const px = 14 + p.x * SCALE;
      const py = 14 + p.y * SCALE;
      if (Math.hypot(px - mx, py - my) < 14) {
        found = p;
        break;
      }
    }
    setHoveredPlayer(found);
  };

  return (
    <div className="relative flex flex-col items-center bg-slate-900 p-3 rounded-2xl border border-slate-800 shadow-xl overflow-hidden group">
      <div className="w-full flex items-center justify-between pb-2 px-1 text-xs text-slate-400 border-b border-slate-800/80 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold text-slate-200">الرادار التكتيكي ثنائي الأبعاد (2D Tactical Radar)</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> المضيف (Home)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> الضيف (Away)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span> الكرة
          </span>
          <span className="text-slate-500">105m × 68m</span>
        </div>
      </div>

      <div className="relative w-full flex justify-center">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPlayer(null)}
          onClick={() => hoveredPlayer && onPlayerClick && onPlayerClick(hoveredPlayer)}
          className="rounded-xl w-full max-w-[735px] h-auto border border-emerald-600/40 cursor-crosshair shadow-2xl transition"
        />

        {/* Hover Tooltip */}
        {hoveredPlayer && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-950/95 backdrop-blur-md text-slate-100 text-xs px-3 py-2 rounded-lg border border-slate-700 shadow-xl flex flex-col gap-1"
            style={{
              top: Math.max(10, Math.min(HEIGHT - 80, hoveredPlayer.y * SCALE - 50)),
              left: Math.max(10, Math.min(WIDTH - 150, hoveredPlayer.x * SCALE + 20)),
            }}
          >
            <div className="flex items-center justify-between gap-3 font-bold border-b border-slate-800 pb-1">
              <span className={hoveredPlayer.team === 'HOME' ? 'text-red-400' : 'text-blue-400'}>
                {hoveredPlayer.team === 'HOME' ? 'المضيف' : 'الضيف'} #{hoveredPlayer.jersey}
              </span>
              <span className="text-emerald-400 font-mono">{hoveredPlayer.speed_kmh} km/h</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
              <span>الإحداثيات:</span>
              <span className="font-mono text-slate-200">
                ({hoveredPlayer.x}m, {hoveredPlayer.y}m)
              </span>
            </div>
          </div>
        )}
      </div>

      {overlayMode === 'PASSING_NETWORK' && passingNetwork && (
        <div className="mt-2 w-full flex items-center justify-between px-3 py-1.5 bg-slate-950/60 rounded-lg text-xs text-sky-400 border border-sky-900/40">
          <span>المساحة التكتيكية لانتشار الفريق (Convex Hull Area):</span>
          <span className="font-mono font-bold text-sm text-sky-300">
            {passingNetwork.team_convex_hull_area_m2} م²
          </span>
        </div>
      )}
    </div>
  );
};
