"use client";

import { useRef, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlayerPosition = {
  x: number;
  y: number;
  label: string;
  highlight?: boolean;           // show glowing ring + bold arrow
  branch?: { x: number; y: number }; // optional dashed alternate route
};
export type DiscPosition = { x: number; y: number };
export type StepPositions = {
  offense: PlayerPosition[]; // length 7
  defense: PlayerPosition[]; // length 7
  disc: DiscPosition;
  note?: string;             // optional per-step coaching note
};

interface FieldCanvasProps {
  steps: StepPositions[];
  currentStep: number;
  mode: "edit" | "view";
  showTracks?: boolean;
  onPositionChange?: (
    team: "offense" | "defense" | "disc",
    playerIndex: number,
    x: number,
    y: number
  ) => void;
  onBranchChange?: (
    team: "offense" | "defense",
    playerIndex: number,
    x: number,
    y: number
  ) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Field rect: 0 0 110 40  (1 SVG unit = 1 yard)
// Staging strip: y 40–62
const VIEWBOX_W = 110;
const VIEWBOX_H = 62; // 40 field + 22 staging
const FIELD_H = 40;

const PLAYER_R = 1.62;
const DISC_R = 1.08;
const HIGHLIGHT_R = 3.0; // glowing ring radius

const COLOR_OFFENSE = "#3b82f6";
const COLOR_DEFENSE = "#ef4444";
const COLOR_DISC_STROKE = "#1e293b";
const COLOR_ARROW_DISC = "#9ca3af";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOnField(x: number, y: number): boolean {
  return x >= 0 && x <= VIEWBOX_W && y >= 0 && y <= FIELD_H;
}

// Returns true if the player has moved a meaningful distance (> 1 yard)
function hasMoved(x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy) > 1;
}

// Shorten the endpoint of a line so it stops `margin` units before (x2, y2)
function shortenEnd(
  x1: number, y1: number,
  x2: number, y2: number,
  margin: number
): { x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= margin) return { x2, y2 }; // too short to shorten
  const t = (len - margin) / len;
  return { x2: x1 + dx * t, y2: y1 + dy * t };
}

// Lighten a hex color by mixing it toward white by `amount` (0–1)
function lightenColor(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

// Render an arrow as outline + foreground line pair for visual clarity.
// The outline is slightly wider and lighter. It is trimmed short of the end so
// it doesn't protrude past the arrowhead. Disc arrows skip the outline entirely.
function arrowLines(
  key: string,
  x1: number, y1: number, x2: number, y2: number,
  stroke: string,
  strokeWidth: number,
  opacity: number,
  markerEnd: string | undefined,
  extraProps: Record<string, string | number | undefined> = {}
): React.ReactNode[] {
  const isDisc = markerEnd?.includes("disc") ?? !markerEnd;
  const foreground = (
    <line
      key={key}
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      markerEnd={markerEnd}
      {...extraProps}
    />
  );

  if (isDisc) {
    // Disc: no outline, just the foreground line
    return [foreground];
  }

  // Shorten outline end by ~1.5 units so it stops behind the arrowhead
  const outlineEnd = shortenEnd(x1, y1, x2, y2, 1.5);
  const outlineColor = lightenColor(stroke, 0.55);
  const outlineWidth = strokeWidth + 0.6;

  return [
    <line
      key={`${key}-outline`}
      x1={x1} y1={y1} x2={outlineEnd.x2} y2={outlineEnd.y2}
      stroke={outlineColor}
      strokeWidth={outlineWidth}
      opacity={opacity * 0.8}
      {...(extraProps.strokeDasharray ? { strokeDasharray: extraProps.strokeDasharray as string } : {})}
    />,
    foreground,
  ];
}

// ─── Default staging positions ────────────────────────────────────────────────

export function defaultStepPositions(): StepPositions {
  // Centre 7 icons (spacing 5) around midpoint 55: 55 - 3*5 = 40 → 40,45,50,55,60,65,70
  const offenseX = [40, 45, 50, 55, 60, 65, 70];
  const defenseX = [40, 45, 50, 55, 60, 65, 70];
  return {
    offense: offenseX.map((x, i) => ({ x, y: 44, label: `O${i + 1}` })),
    defense: defenseX.map((x, i) => ({ x, y: 52, label: `D${i + 1}` })),
    disc: { x: 55, y: 48 },
  };
}

// ─── Drag state ───────────────────────────────────────────────────────────────

type DragTarget =
  | { team: "offense"; index: number; kind: "player" }
  | { team: "defense"; index: number; kind: "player" }
  | { team: "disc"; index: 0; kind: "player" }
  | { team: "offense"; index: number; kind: "branch" }
  | { team: "defense"; index: number; kind: "branch" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function FieldCanvas({
  steps,
  currentStep,
  mode,
  showTracks = true,
  onPositionChange,
  onBranchChange,
}: FieldCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragTarget | null>(null);

  const current = steps[currentStep];
  const prev = currentStep > 0 ? steps[currentStep - 1] : null;

  // Convert a client mouse event to SVG coordinate space
  const clientToSvg = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const scaleX = VIEWBOX_W / rect.width;
      const scaleY = VIEWBOX_H / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const handleMouseDown = useCallback(
    (target: DragTarget) => (e: React.MouseEvent) => {
      if (mode !== "edit") return;
      e.preventDefault();
      e.stopPropagation();
      setDrag(target);
    },
    [mode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!drag || mode !== "edit") return;
      const { x, y } = clientToSvg(e.clientX, e.clientY);
      if (drag.kind === "branch") {
        onBranchChange?.(drag.team, drag.index, x, y);
      } else {
        onPositionChange?.(drag.team, drag.index, x, y);
      }
    },
    [drag, mode, clientToSvg, onPositionChange, onBranchChange]
  );

  const handleMouseUp = useCallback(() => {
    setDrag(null);
  }, []);

  // ─── Arrow rendering ────────────────────────────────────────────────────────

  function renderArrows() {
    if (!prev) return null;

    if (mode === "view") {
      const arrows: React.ReactNode[] = [];

      for (let s = 1; s <= currentStep; s++) {
        const isCurrent = s === currentStep;
        // Skip ghost trail steps when tracks are hidden
        if (!isCurrent && !showTracks) continue;
        const from = steps[s - 1];
        const to = steps[s];
        const opacity = isCurrent ? 1 : 0.2;

        from.offense.forEach((p, i) => {
          const c = to.offense[i];
          const moved = hasMoved(p.x, p.y, c.x, c.y);
          if (isOnField(p.x, p.y) && isOnField(c.x, c.y) && moved) {
            const end = shortenEnd(p.x, p.y, c.x, c.y, PLAYER_R + 0.3);
            arrows.push(...arrowLines(`ao-${s}-${i}`, p.x, p.y, end.x2, end.y2,
              COLOR_OFFENSE, 0.8, opacity,
              isCurrent ? "url(#arrow-offense)" : undefined));
          }
          if (isCurrent && c.branch && isOnField(p.x, p.y) && isOnField(c.branch.x, c.branch.y)
              && hasMoved(p.x, p.y, c.branch.x, c.branch.y)) {
            const end = shortenEnd(p.x, p.y, c.branch.x, c.branch.y, PLAYER_R + 0.3);
            arrows.push(...arrowLines(`ao-branch-${s}-${i}`, p.x, p.y, end.x2, end.y2,
              COLOR_OFFENSE, 0.8, 0.85, "url(#arrow-offense)", { strokeDasharray: "1.5 1" }));
          }
        });

        from.defense.forEach((p, i) => {
          const c = to.defense[i];
          const moved = hasMoved(p.x, p.y, c.x, c.y);
          if (isOnField(p.x, p.y) && isOnField(c.x, c.y) && moved) {
            const end = shortenEnd(p.x, p.y, c.x, c.y, PLAYER_R + 0.3);
            arrows.push(...arrowLines(`ad-${s}-${i}`, p.x, p.y, end.x2, end.y2,
              COLOR_DEFENSE, 0.8, opacity,
              isCurrent ? "url(#arrow-defense)" : undefined));
          }
          if (isCurrent && c.branch && isOnField(p.x, p.y) && isOnField(c.branch.x, c.branch.y)
              && hasMoved(p.x, p.y, c.branch.x, c.branch.y)) {
            const end = shortenEnd(p.x, p.y, c.branch.x, c.branch.y, PLAYER_R + 0.3);
            arrows.push(...arrowLines(`ad-branch-${s}-${i}`, p.x, p.y, end.x2, end.y2,
              COLOR_DEFENSE, 0.8, 0.85, "url(#arrow-defense)", { strokeDasharray: "1.5 1" }));
          }
        });

        {
          const p = from.disc;
          const c = to.disc;
          if (isOnField(p.x, p.y) && isOnField(c.x, c.y) && hasMoved(p.x, p.y, c.x, c.y)) {
            const end = shortenEnd(p.x, p.y, c.x, c.y, DISC_R + 0.3);
            arrows.push(...arrowLines(`adisc-${s}`, p.x, p.y, end.x2, end.y2,
              COLOR_ARROW_DISC, isCurrent ? 0.5 : 0.4, opacity,
              isCurrent ? "url(#arrow-disc)" : undefined,
              isCurrent ? { strokeDasharray: "3 1.2" } : {}));
          }
        }
      }

      return arrows;
    }

    // ── Edit mode: draw only prev → current arrows ──
    const arrows: React.ReactNode[] = [];

    current.offense.forEach((cur, i) => {
      const p = prev.offense[i];
      if (isOnField(p.x, p.y) && isOnField(cur.x, cur.y) && hasMoved(p.x, p.y, cur.x, cur.y)) {
        const end = shortenEnd(p.x, p.y, cur.x, cur.y, PLAYER_R + 0.3);
        arrows.push(...arrowLines(`ao-${i}`, p.x, p.y, end.x2, end.y2,
          COLOR_OFFENSE, 0.8, 1, "url(#arrow-offense)"));
      }
      if (cur.branch && isOnField(p.x, p.y) && isOnField(cur.branch.x, cur.branch.y)
          && hasMoved(p.x, p.y, cur.branch.x, cur.branch.y)) {
        const end = shortenEnd(p.x, p.y, cur.branch.x, cur.branch.y, PLAYER_R + 0.3);
        arrows.push(...arrowLines(`ao-branch-${i}`, p.x, p.y, end.x2, end.y2,
          COLOR_OFFENSE, 0.8, 0.85, "url(#arrow-offense)", { strokeDasharray: "1.5 1" }));
      }
    });

    current.defense.forEach((cur, i) => {
      const p = prev.defense[i];
      if (isOnField(p.x, p.y) && isOnField(cur.x, cur.y) && hasMoved(p.x, p.y, cur.x, cur.y)) {
        const end = shortenEnd(p.x, p.y, cur.x, cur.y, PLAYER_R + 0.3);
        arrows.push(...arrowLines(`ad-${i}`, p.x, p.y, end.x2, end.y2,
          COLOR_DEFENSE, 0.8, 1, "url(#arrow-defense)"));
      }
      if (cur.branch && isOnField(p.x, p.y) && isOnField(cur.branch.x, cur.branch.y)
          && hasMoved(p.x, p.y, cur.branch.x, cur.branch.y)) {
        const end = shortenEnd(p.x, p.y, cur.branch.x, cur.branch.y, PLAYER_R + 0.3);
        arrows.push(...arrowLines(`ad-branch-${i}`, p.x, p.y, end.x2, end.y2,
          COLOR_DEFENSE, 0.8, 0.85, "url(#arrow-defense)", { strokeDasharray: "1.5 1" }));
      }
    });

    {
      const p = prev.disc;
      const c = current.disc;
      if (isOnField(p.x, p.y) && isOnField(c.x, c.y) && hasMoved(p.x, p.y, c.x, c.y)) {
        const end = shortenEnd(p.x, p.y, c.x, c.y, DISC_R + 0.3);
        arrows.push(...arrowLines("ad-disc", p.x, p.y, end.x2, end.y2,
          COLOR_ARROW_DISC, 0.5, 1, "url(#arrow-disc)", { strokeDasharray: "3 1.2" }));
      }
    }

    return arrows;
  }

  // ─── Branch dot handles (edit mode only) ────────────────────────────────────

  function renderBranchHandles() {
    if (mode !== "edit") return null;
    const handles: React.ReactNode[] = [];

    current.offense.forEach((p, i) => {
      if (p.branch && isOnField(p.branch.x, p.branch.y)) {
        handles.push(
          <g
            key={`bh-o-${i}`}
            transform={`translate(${p.branch.x}, ${p.branch.y})`}
            style={{ cursor: "grab" }}
            onMouseDown={handleMouseDown({ team: "offense", index: i, kind: "branch" })}
          >
            <circle r={1.1} fill={COLOR_OFFENSE} opacity={0.7} />
            <circle r={0.5} fill="white" opacity={0.9} />
          </g>
        );
      }
    });

    current.defense.forEach((p, i) => {
      if (p.branch && isOnField(p.branch.x, p.branch.y)) {
        handles.push(
          <g
            key={`bh-d-${i}`}
            transform={`translate(${p.branch.x}, ${p.branch.y})`}
            style={{ cursor: "grab" }}
            onMouseDown={handleMouseDown({ team: "defense", index: i, kind: "branch" })}
          >
            <circle r={1.1} fill={COLOR_DEFENSE} opacity={0.7} />
            <circle r={0.5} fill="white" opacity={0.9} />
          </g>
        );
      }
    });

    return handles;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const viewH = mode === "view" ? FIELD_H : VIEWBOX_H;

  return (
    <div style={{ width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_W} ${viewH}`}
        width="100%"
        height="auto"
        style={{ display: "block", userSelect: "none" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* ── Defs: arrowhead markers + highlight glow filter ── */}
        <defs>
          {/* Player arrowheads */}
          {(
            [
              ["arrow-offense", COLOR_OFFENSE],
              ["arrow-defense", COLOR_DEFENSE],
            ] as const
          ).map(([id, color]) => (
            <marker
              key={id}
              id={id}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          ))}
          {/* Disc arrowhead — open chevron foreground + outline */}
          <marker
            id="arrow-disc"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke={COLOR_ARROW_DISC} strokeWidth="1.8" strokeLinejoin="round" />
          </marker>
          {/* Glow filter for highlighted players */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Field background ── */}
        <rect x={0} y={0} width={VIEWBOX_W} height={FIELD_H} fill="#3a7d44" />

        {/* ── Perimeter outline ── */}
        <rect
          x={0} y={0}
          width={VIEWBOX_W} height={FIELD_H}
          fill="none"
          stroke="white"
          strokeWidth={0.5}
        />

        {/* ── End zone lines ── */}
        <line x1={20} y1={0} x2={20} y2={FIELD_H} stroke="white" strokeWidth={0.5} />
        <line x1={90} y1={0} x2={90} y2={FIELD_H} stroke="white" strokeWidth={0.5} />

        {/* ── Brick marks at (40,20) and (70,20) ── */}
        {[40, 70].map((bx) => (
          <g key={bx}>
            <line x1={bx - 0.7} y1={20 - 0.7} x2={bx + 0.7} y2={20 + 0.7} stroke="white" strokeWidth={0.4} />
            <line x1={bx + 0.7} y1={20 - 0.7} x2={bx - 0.7} y2={20 + 0.7} stroke="white" strokeWidth={0.4} />
          </g>
        ))}

        {/* ── Staging area (edit mode only) ── */}
        {mode === "edit" && (
          <>
            <rect x={0} y={FIELD_H} width={VIEWBOX_W} height={VIEWBOX_H - FIELD_H} fill="#1e293b" />
            <text
              x={VIEWBOX_W / 2}
              y={VIEWBOX_H - 1.5}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={2.2}
              fontFamily="system-ui, sans-serif"
            >
              Drag players onto the field
            </text>
          </>
        )}

        {/* ── Route arrows (rendered below players) ── */}
        {renderArrows()}

        {/* ── Branch destination handles (edit mode) ── */}
        {renderBranchHandles()}

        {/* ── Offense players ── */}
        {current.offense.map((p, i) => (
          <g
            key={`o-${i}`}
            transform={`translate(${p.x}, ${p.y})`}
            style={{
              cursor: mode === "edit" ? "grab" : "default",
              ...(mode === "view" ? { transition: "transform 0.8s ease" } : {}),
            }}
            onMouseDown={handleMouseDown({ team: "offense", index: i, kind: "player" })}
          >
            {/* Highlight ring */}
            {p.highlight && (
              <circle
                r={HIGHLIGHT_R}
                fill={COLOR_OFFENSE}
                opacity={0.35}
                filter="url(#glow)"
                style={mode === "view" ? { animation: "pulse 1.2s ease-in-out infinite" } : undefined}
              />
            )}
            <circle r={PLAYER_R} fill={COLOR_OFFENSE} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={1.6}
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
              style={{ pointerEvents: "none" }}
            >
              {p.label}
            </text>
          </g>
        ))}

        {/* ── Defense players ── */}
        {current.defense.map((p, i) => (
          <g
            key={`d-${i}`}
            transform={`translate(${p.x}, ${p.y})`}
            style={{
              cursor: mode === "edit" ? "grab" : "default",
              ...(mode === "view" ? { transition: "transform 0.8s ease" } : {}),
            }}
            onMouseDown={handleMouseDown({ team: "defense", index: i, kind: "player" })}
          >
            {/* Highlight ring */}
            {p.highlight && (
              <circle
                r={HIGHLIGHT_R}
                fill={COLOR_DEFENSE}
                opacity={0.35}
                filter="url(#glow)"
                style={mode === "view" ? { animation: "pulse 1.2s ease-in-out infinite" } : undefined}
              />
            )}
            <circle r={PLAYER_R} fill={COLOR_DEFENSE} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={1.6}
              fontWeight="bold"
              fontFamily="system-ui, sans-serif"
              style={{ pointerEvents: "none" }}
            >
              {p.label}
            </text>
          </g>
        ))}

        {/* ── Disc ── */}
        <g
          transform={`translate(${current.disc.x}, ${current.disc.y})`}
          style={{
            cursor: mode === "edit" ? "grab" : "default",
            ...(mode === "view" ? { transition: "transform 0.8s ease" } : {}),
          }}
          onMouseDown={handleMouseDown({ team: "disc", index: 0, kind: "player" })}
        >
          <circle r={DISC_R} fill="white" stroke={COLOR_DISC_STROKE} strokeWidth={0.5} />
        </g>
      </svg>

      {/* ── Notes panel (view mode only) — always rendered to prevent layout shift ── */}
      {mode === "view" && (
        <div style={{
          background: "#f8fafc",
          borderTop: "1px solid #e2e8f0",
          padding: "8px 12px",
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          color: "#475569",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          minHeight: "42px",       // fixed height — controls never shift
        }}>
          {current.note ? (
            <>
              <span style={{ fontWeight: 600, color: "#334155", marginRight: 6 }}>
                Step {currentStep + 1}:
              </span>
              {current.note}
            </>
          ) : null}
        </div>
      )}

      {/* Pulse keyframe injected once */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
