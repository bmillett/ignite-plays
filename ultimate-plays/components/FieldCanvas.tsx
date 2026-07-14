"use client";

import { useRef, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlayerPosition = { x: number; y: number; label: string };
export type DiscPosition = { x: number; y: number };
export type StepPositions = {
  offense: PlayerPosition[]; // length 7
  defense: PlayerPosition[]; // length 7
  disc: DiscPosition;
};

interface FieldCanvasProps {
  steps: StepPositions[];
  currentStep: number;
  mode: "edit" | "view";
  onPositionChange?: (
    team: "offense" | "defense" | "disc",
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

const COLOR_OFFENSE = "#3b82f6";
const COLOR_DEFENSE = "#ef4444";
const COLOR_DISC_STROKE = "#1e293b";
const COLOR_ARROW_DISC = "#9ca3af";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOnField(x: number, y: number): boolean {
  return x >= 0 && x <= VIEWBOX_W && y >= 0 && y <= FIELD_H;
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
  | { team: "offense"; index: number }
  | { team: "defense"; index: number }
  | { team: "disc"; index: 0 };

// ─── Component ────────────────────────────────────────────────────────────────

export default function FieldCanvas({
  steps,
  currentStep,
  mode,
  onPositionChange,
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
      setDrag(target);
    },
    [mode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!drag || mode !== "edit") return;
      const { x, y } = clientToSvg(e.clientX, e.clientY);
      onPositionChange?.(drag.team, drag.index, x, y);
    },
    [drag, mode, clientToSvg, onPositionChange]
  );

  const handleMouseUp = useCallback(() => {
    setDrag(null);
  }, []);

  // ─── Arrow rendering ────────────────────────────────────────────────────────

  function renderArrows() {
    if (!prev) return null;

    if (mode === "view") {
      // In view mode: render ghost trails for all previous transitions, full
      // opacity only for the current transition (steps[currentStep-1] → steps[currentStep]).
      const arrows: React.ReactNode[] = [];

      for (let s = 1; s <= currentStep; s++) {
        const from = steps[s - 1];
        const to = steps[s];
        const isCurrent = s === currentStep;
        const opacity = isCurrent ? 1 : 0.2;

        from.offense.forEach((p, i) => {
          const c = to.offense[i];
          if (isOnField(p.x, p.y) && isOnField(c.x, c.y)) {
            arrows.push(
              <line
                key={`ao-${s}-${i}`}
                x1={p.x} y1={p.y} x2={c.x} y2={c.y}
                stroke={COLOR_OFFENSE}
                strokeWidth={0.8}
                opacity={opacity}
                markerEnd={isCurrent ? "url(#arrow-offense)" : undefined}
              />
            );
          }
        });

        from.defense.forEach((p, i) => {
          const c = to.defense[i];
          if (isOnField(p.x, p.y) && isOnField(c.x, c.y)) {
            arrows.push(
              <line
                key={`ad-${s}-${i}`}
                x1={p.x} y1={p.y} x2={c.x} y2={c.y}
                stroke={COLOR_DEFENSE}
                strokeWidth={0.8}
                opacity={opacity}
                markerEnd={isCurrent ? "url(#arrow-defense)" : undefined}
              />
            );
          }
        });

        {
          const p = from.disc;
          const c = to.disc;
          if (isOnField(p.x, p.y) && isOnField(c.x, c.y)) {
            arrows.push(
              <line
                key={`adisc-${s}`}
                x1={p.x} y1={p.y} x2={c.x} y2={c.y}
                stroke={COLOR_ARROW_DISC}
                strokeWidth={0.8}
                opacity={opacity}
                markerEnd={isCurrent ? "url(#arrow-disc)" : undefined}
              />
            );
          }
        }
      }

      return arrows;
    }

    // Edit mode: draw only prev → current arrows
    const arrows: React.ReactNode[] = [];

    current.offense.forEach((cur, i) => {
      const p = prev.offense[i];
      if (isOnField(p.x, p.y) && isOnField(cur.x, cur.y)) {
        arrows.push(
          <line
            key={`ao-${i}`}
            x1={p.x} y1={p.y} x2={cur.x} y2={cur.y}
            stroke={COLOR_OFFENSE}
            strokeWidth={0.8}
            markerEnd="url(#arrow-offense)"
          />
        );
      }
    });

    current.defense.forEach((cur, i) => {
      const p = prev.defense[i];
      if (isOnField(p.x, p.y) && isOnField(cur.x, cur.y)) {
        arrows.push(
          <line
            key={`ad-${i}`}
            x1={p.x} y1={p.y} x2={cur.x} y2={cur.y}
            stroke={COLOR_DEFENSE}
            strokeWidth={0.8}
            markerEnd="url(#arrow-defense)"
          />
        );
      }
    });

    {
      const p = prev.disc;
      const c = current.disc;
      if (isOnField(p.x, p.y) && isOnField(c.x, c.y)) {
        arrows.push(
          <line
            key="ad-disc"
            x1={p.x} y1={p.y} x2={c.x} y2={c.y}
            stroke={COLOR_ARROW_DISC}
            strokeWidth={0.8}
            markerEnd="url(#arrow-disc)"
          />
        );
      }
    }

    return arrows;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        width="100%"
        height="auto"
        style={{ display: "block", userSelect: "none" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* ── Defs: arrowhead markers ── */}
        <defs>
          {(
            [
              ["arrow-offense", COLOR_OFFENSE],
              ["arrow-defense", COLOR_DEFENSE],
              ["arrow-disc", COLOR_ARROW_DISC],
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
        </defs>

        {/* ── Field background ── */}
        <rect x={0} y={0} width={VIEWBOX_W} height={FIELD_H} fill="#3a7d44" />

        {/* ── Perimeter outline ── */}
        <rect
          x={0}
          y={0}
          width={VIEWBOX_W}
          height={FIELD_H}
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
            <line
              x1={bx - 0.7}
              y1={20 - 0.7}
              x2={bx + 0.7}
              y2={20 + 0.7}
              stroke="white"
              strokeWidth={0.4}
            />
            <line
              x1={bx + 0.7}
              y1={20 - 0.7}
              x2={bx - 0.7}
              y2={20 + 0.7}
              stroke="white"
              strokeWidth={0.4}
            />
          </g>
        ))}

        {/* ── Staging area ── */}
        <rect
          x={0}
          y={FIELD_H}
          width={VIEWBOX_W}
          height={VIEWBOX_H - FIELD_H}
          fill="#1e293b"
        />
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

        {/* ── Route arrows (below players so they render underneath) ── */}
        {renderArrows()}

        {/* ── Offense players ── */}
        {current.offense.map((p, i) => (
          <g
            key={`o-${i}`}
            transform={`translate(${p.x}, ${p.y})`}
            style={{
              cursor: mode === "edit" ? "grab" : "default",
              ...(mode === "view" ? { transition: "transform 0.8s ease" } : {}),
            }}
            onMouseDown={handleMouseDown({ team: "offense", index: i })}
          >
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
            onMouseDown={handleMouseDown({ team: "defense", index: i })}
          >
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
          onMouseDown={handleMouseDown({ team: "disc", index: 0 })}
        >
          <circle
            r={DISC_R}
            fill="white"
            stroke={COLOR_DISC_STROKE}
            strokeWidth={0.5}
          />
        </g>
      </svg>
    </div>
  );
}
