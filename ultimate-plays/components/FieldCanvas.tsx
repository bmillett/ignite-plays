"use client";

import { useRef, useState, useCallback, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlayerPosition = {
  x: number;
  y: number;
  label: string;
  highlight?: boolean;
  branch?: { x: number; y: number };
};
export type DiscPosition = { x: number; y: number };

// ── Annotation types ──────────────────────────────────────────────────────────
export type AnnotationColor = "white" | "yellow" | "red" | "cyan";

export type TextAnnotation = {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  color: AnnotationColor;
};

export type ArrowAnnotation = {
  id: string;
  type: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: AnnotationColor;
};

export type Annotation = TextAnnotation | ArrowAnnotation;

export type StepPositions = {
  offense: PlayerPosition[];   // length 7
  defense: PlayerPosition[];   // length 7
  disc: DiscPosition;
  note?: string;
  annotations?: Annotation[];
};

// ── Tool mode passed in from editor ──────────────────────────────────────────
export type AnnotationToolMode =
  | { type: "text";  color: AnnotationColor }
  | { type: "arrow"; color: AnnotationColor }
  | null;

interface FieldCanvasProps {
  steps: StepPositions[];
  currentStep: number;
  mode: "edit" | "view";
  showTracks?: boolean;
  annotationTool?: AnnotationToolMode;
  onAnnotationAdd?: (ann: Annotation) => void;
  onAnnotationMove?: (id: string, patch: Partial<Annotation>) => void;
  onAnnotationDelete?: (id: string) => void;
  onAnnotationTextEdit?: (id: string, text: string) => void;
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
const VIEWBOX_W = 110;
const VIEWBOX_H = 62;
const FIELD_H = 40;

const PLAYER_R = 1.62;
const DISC_R = 1.08;
const HIGHLIGHT_R = 3.0;

const COLOR_OFFENSE    = "#3b82f6";
const COLOR_DEFENSE    = "#ef4444";
const COLOR_DISC_STROKE = "#1e293b";
const COLOR_ARROW_DISC = "#9ca3af";

const ANN_COLOR_MAP: Record<AnnotationColor, string> = {
  white:  "#ffffff",
  yellow: "#facc15",
  red:    "#f87171",
  cyan:   "#22d3ee",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOnField(x: number, y: number): boolean {
  return x >= 0 && x <= VIEWBOX_W && y >= 0 && y <= FIELD_H;
}

function hasMoved(x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy) > 1;
}

function shortenEnd(
  x1: number, y1: number,
  x2: number, y2: number,
  margin: number
): { x2: number; y2: number } {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len <= margin) return { x2, y2 };
  const t = (len - margin) / len;
  return { x2: x1 + dx * t, y2: y1 + dy * t };
}

function lightenColor(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8)  & 0xff;
  const b =  n        & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

// SVG marker geometry (markerUnits=strokeWidth, the default):
//   We use refX="10" so the arrowhead TIP aligns exactly with the line endpoint.
//   This means zero tip protrusion — the line endpoint IS the tip landing spot.
//
//   Rendered head depth = (10/10) × MARKER_WIDTH × strokeWidth SVG units
//   (the entire head body sits BEHIND the endpoint)
//
//   Strategy:
//   - Shorten the line by (targetRadius + ARROW_GAP) so the tip lands at
//     the gap distance from the target circle edge.
//   - The outline (wider stroke, no head) stops an extra headDepth behind
//     the tip so it doesn't poke through the arrowhead.

const MARKER_WIDTH = 4;
const ARROW_GAP    = 1.2;

// With refX=10, the tip IS the line endpoint → tipProtrusion = 0.
// headBodyDepth = full MARKER_WIDTH × strokeWidth (entire head is behind endpoint).
function headBodyDepth(sw: number): number { return MARKER_WIDTH * sw; }

function arrowLines(
  key: string,
  x1: number, y1: number, x2: number, y2: number,
  stroke: string,
  strokeWidth: number,
  opacity: number,
  markerEnd: string | undefined,
  targetRadius: number = 0,
  extraProps: Record<string, string | number | undefined> = {}
): React.ReactNode[] {
  const isDisc  = markerEnd?.includes("disc") ?? !markerEnd;
  const hasHead = !!markerEnd && !isDisc;

  // Tip lands exactly at the line endpoint (refX=10 → zero protrusion).
  // We shorten so tip is ARROW_GAP past the target circle edge.
  const tipDist  = hasHead ? targetRadius + ARROW_GAP : targetRadius;
  const tipEnd   = tipDist > 0 ? shortenEnd(x1, y1, x2, y2, tipDist) : { x2, y2 };

  // Outline must not extend into arrowhead — stop it headBodyDepth behind the tip.
  const outlineWidth = strokeWidth + 0.15;
  const outlineStop  = tipDist + headBodyDepth(strokeWidth) + outlineWidth / 2 + 0.1;
  const outlineEnd   = shortenEnd(x1, y1, x2, y2, outlineStop);

  const foreground = (
    <line
      key={key}
      x1={x1} y1={y1} x2={tipEnd.x2} y2={tipEnd.y2}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      markerEnd={hasHead ? markerEnd : undefined}
      {...extraProps}
    />
  );

  if (isDisc) return [foreground];

  const outlineColor = lightenColor(stroke, 0.55);
  return [
    <line
      key={`${key}-outline`}
      x1={x1} y1={y1} x2={outlineEnd.x2} y2={outlineEnd.y2}
      stroke={outlineColor}
      strokeWidth={outlineWidth}
      opacity={opacity * 0.8}
      {...(extraProps.strokeDasharray
        ? { strokeDasharray: extraProps.strokeDasharray as string }
        : {})}
    />,
    foreground,
  ];
}

// ─── Default staging positions ────────────────────────────────────────────────

export function defaultStepPositions(): StepPositions {
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
  | { team: "disc";    index: 0;      kind: "player" }
  | { team: "offense"; index: number; kind: "branch" }
  | { team: "defense"; index: number; kind: "branch" }
  | { kind: "ann-body";  id: string; startX: number; startY: number; mouseX: number; mouseY: number }
  | { kind: "ann-tail";  id: string }   // dragging arrow origin
  | { kind: "ann-head";  id: string };  // dragging arrow tip

// ─── Component ────────────────────────────────────────────────────────────────

export default function FieldCanvas({
  steps,
  currentStep,
  mode,
  showTracks = true,
  annotationTool = null,
  onAnnotationAdd,
  onAnnotationMove,
  onAnnotationDelete,
  onAnnotationTextEdit,
  onPositionChange,
  onBranchChange,
}: FieldCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag]             = useState<DragTarget | null>(null);
  const [hoveredAnn, setHoveredAnn] = useState<string | null>(null);
  const [editingAnn, setEditingAnn] = useState<string | null>(null);
  const [editText, setEditText]     = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const current = steps[currentStep];
  const prev    = currentStep > 0 ? steps[currentStep - 1] : null;

  // Focus text input when edit starts
  useEffect(() => {
    if (editingAnn && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingAnn]);

  // ── SVG coordinate helper ────────────────────────────────────────────────
  const clientToSvg = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect   = svg.getBoundingClientRect();
      const scaleX = VIEWBOX_W / rect.width;
      const scaleY = (mode === "view" ? FIELD_H : VIEWBOX_H) / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top)  * scaleY,
      };
    },
    [mode]
  );

  // ── Mouse events ─────────────────────────────────────────────────────────
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
      } else if (drag.kind === "player") {
        onPositionChange?.(drag.team, drag.index, x, y);
      } else if (drag.kind === "ann-body") {
        const dx = x - drag.mouseX;
        const dy = y - drag.mouseY;
        const ann = current.annotations?.find(a => a.id === drag.id);
        if (!ann) return;
        if (ann.type === "text") {
          onAnnotationMove?.(drag.id, { x: drag.startX + dx, y: drag.startY + dy } as Partial<Annotation>);
        } else if (ann.type === "arrow") {
          onAnnotationMove?.(drag.id, {
            x1: ann.x1 + dx, y1: ann.y1 + dy,
            x2: ann.x2 + dx, y2: ann.y2 + dy,
          } as Partial<Annotation>);
        }
      } else if (drag.kind === "ann-tail") {
        onAnnotationMove?.(drag.id, { x1: x, y1: y } as Partial<Annotation>);
      } else if (drag.kind === "ann-head") {
        onAnnotationMove?.(drag.id, { x2: x, y2: y } as Partial<Annotation>);
      }
    },
    [drag, mode, clientToSvg, onPositionChange, onBranchChange, onAnnotationMove, current]
  );

  const handleMouseUp = useCallback(() => setDrag(null), []);

  // ── SVG click — place annotation in tool mode ─────────────────────────────
  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (mode !== "edit" || !annotationTool) return;
      // Ignore if we just finished a drag (moved more than a tiny amount)
      if (drag !== null) return;
      const { x, y } = clientToSvg(e.clientX, e.clientY);
      const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (annotationTool.type === "text") {
        onAnnotationAdd?.({
          id, type: "text",
          x, y,
          text: "Label",
          color: annotationTool.color,
        });
        // Immediately enter edit mode for the new label
        setEditingAnn(id);
        setEditText("Label");
      } else if (annotationTool.type === "arrow") {
        onAnnotationAdd?.({
          id, type: "arrow",
          x1: x, y1: y,
          x2: x + 8, y2: y,
          color: annotationTool.color,
        });
      }
    },
    [mode, annotationTool, drag, clientToSvg, onAnnotationAdd]
  );

  // ── Commit text edit ──────────────────────────────────────────────────────
  function commitTextEdit() {
    if (editingAnn) {
      onAnnotationTextEdit?.(editingAnn, editText.trim() || "Label");
    }
    setEditingAnn(null);
    setEditText("");
  }

  // ─── Arrow rendering ──────────────────────────────────────────────────────

  function renderArrows() {
    if (!prev) return null;

    if (mode === "view") {
      const arrows: React.ReactNode[] = [];

      for (let s = 1; s <= currentStep; s++) {
        const isCurrent = s === currentStep;
        if (!isCurrent && !showTracks) continue;
        const from    = steps[s - 1];
        const to      = steps[s];
        const opacity = isCurrent ? 1 : 0.2;

        from.offense.forEach((p, i) => {
          const c    = to.offense[i];
          const moved = hasMoved(p.x, p.y, c.x, c.y);
          if (isOnField(p.x, p.y) && isOnField(c.x, c.y) && moved) {
            arrows.push(...arrowLines(`ao-${s}-${i}`, p.x, p.y, c.x, c.y,
              COLOR_OFFENSE, 0.55, opacity,
              isCurrent ? "url(#arrow-offense)" : undefined,
              PLAYER_R));
          }
          if (isCurrent && c.branch
              && isOnField(p.x, p.y) && isOnField(c.branch.x, c.branch.y)
              && hasMoved(p.x, p.y, c.branch.x, c.branch.y)) {
            arrows.push(...arrowLines(`ao-branch-${s}-${i}`, p.x, p.y, c.branch.x, c.branch.y,
              COLOR_OFFENSE, 0.55, 0.85, "url(#arrow-offense)", PLAYER_R, { strokeDasharray: "1.5 1" }));
          }
        });

        from.defense.forEach((p, i) => {
          const c    = to.defense[i];
          const moved = hasMoved(p.x, p.y, c.x, c.y);
          if (isOnField(p.x, p.y) && isOnField(c.x, c.y) && moved) {
            arrows.push(...arrowLines(`ad-${s}-${i}`, p.x, p.y, c.x, c.y,
              COLOR_DEFENSE, 0.55, opacity,
              isCurrent ? "url(#arrow-defense)" : undefined,
              PLAYER_R));
          }
          if (isCurrent && c.branch
              && isOnField(p.x, p.y) && isOnField(c.branch.x, c.branch.y)
              && hasMoved(p.x, p.y, c.branch.x, c.branch.y)) {
            arrows.push(...arrowLines(`ad-branch-${s}-${i}`, p.x, p.y, c.branch.x, c.branch.y,
              COLOR_DEFENSE, 0.55, 0.85, "url(#arrow-defense)", PLAYER_R, { strokeDasharray: "1.5 1" }));
          }
        });

        {
          const p = from.disc, c = to.disc;
          if (isOnField(p.x, p.y) && isOnField(c.x, c.y) && hasMoved(p.x, p.y, c.x, c.y)) {
            arrows.push(...arrowLines(`adisc-${s}`, p.x, p.y, c.x, c.y,
              COLOR_ARROW_DISC, isCurrent ? 0.5 : 0.4, opacity,
              isCurrent ? "url(#arrow-disc)" : undefined,
              DISC_R,
              isCurrent ? { strokeDasharray: "3 1.2" } : {}));
          }
        }
      }

      return arrows;
    }

    // ── Edit mode ──
    const arrows: React.ReactNode[] = [];

    current.offense.forEach((cur, i) => {
      const p = prev.offense[i];
      if (isOnField(p.x, p.y) && isOnField(cur.x, cur.y) && hasMoved(p.x, p.y, cur.x, cur.y)) {
        arrows.push(...arrowLines(`ao-${i}`, p.x, p.y, cur.x, cur.y,
          COLOR_OFFENSE, 0.55, 1, "url(#arrow-offense)", PLAYER_R));
      }
      if (cur.branch && isOnField(p.x, p.y) && isOnField(cur.branch.x, cur.branch.y)
          && hasMoved(p.x, p.y, cur.branch.x, cur.branch.y)) {
        arrows.push(...arrowLines(`ao-branch-${i}`, p.x, p.y, cur.branch.x, cur.branch.y,
          COLOR_OFFENSE, 0.55, 0.85, "url(#arrow-offense)", PLAYER_R, { strokeDasharray: "1.5 1" }));
      }
    });

    current.defense.forEach((cur, i) => {
      const p = prev.defense[i];
      if (isOnField(p.x, p.y) && isOnField(cur.x, cur.y) && hasMoved(p.x, p.y, cur.x, cur.y)) {
        arrows.push(...arrowLines(`ad-${i}`, p.x, p.y, cur.x, cur.y,
          COLOR_DEFENSE, 0.55, 1, "url(#arrow-defense)", PLAYER_R));
      }
      if (cur.branch && isOnField(p.x, p.y) && isOnField(cur.branch.x, cur.branch.y)
          && hasMoved(p.x, p.y, cur.branch.x, cur.branch.y)) {
        arrows.push(...arrowLines(`ad-branch-${i}`, p.x, p.y, cur.branch.x, cur.branch.y,
          COLOR_DEFENSE, 0.55, 0.85, "url(#arrow-defense)", PLAYER_R, { strokeDasharray: "1.5 1" }));
      }
    });

    {
      const p = prev.disc, c = current.disc;
      if (isOnField(p.x, p.y) && isOnField(c.x, c.y) && hasMoved(p.x, p.y, c.x, c.y)) {
        arrows.push(...arrowLines("ad-disc", p.x, p.y, c.x, c.y,
          COLOR_ARROW_DISC, 0.5, 1, "url(#arrow-disc)", DISC_R, { strokeDasharray: "3 1.2" }));
      }
    }

    return arrows;
  }

  // ─── Branch handles (edit mode only) ────────────────────────────────────────

  function renderBranchHandles() {
    if (mode !== "edit") return null;
    const handles: React.ReactNode[] = [];

    current.offense.forEach((p, i) => {
      if (p.branch && isOnField(p.branch.x, p.branch.y)) {
        handles.push(
          <g key={`bh-o-${i}`}
            transform={`translate(${p.branch.x}, ${p.branch.y})`}
            style={{ cursor: "grab" }}
            onMouseDown={handleMouseDown({ team: "offense", index: i, kind: "branch" })}>
            <circle r={1.1} fill={COLOR_OFFENSE} opacity={0.7} />
            <circle r={0.5} fill="white" opacity={0.9} />
          </g>
        );
      }
    });

    current.defense.forEach((p, i) => {
      if (p.branch && isOnField(p.branch.x, p.branch.y)) {
        handles.push(
          <g key={`bh-d-${i}`}
            transform={`translate(${p.branch.x}, ${p.branch.y})`}
            style={{ cursor: "grab" }}
            onMouseDown={handleMouseDown({ team: "defense", index: i, kind: "branch" })}>
            <circle r={1.1} fill={COLOR_DEFENSE} opacity={0.7} />
            <circle r={0.5} fill="white" opacity={0.9} />
          </g>
        );
      }
    });

    return handles;
  }

  // ─── Annotation rendering ────────────────────────────────────────────────────

  function renderAnnotations() {
    const anns = current.annotations;
    if (!anns || anns.length === 0) return null;

    return anns.map((ann) => {
      const color   = ANN_COLOR_MAP[ann.color];
      const isHover = hoveredAnn === ann.id;
      const isEdit  = editingAnn === ann.id;

      if (ann.type === "text") {
        return (
          <g
            key={ann.id}
            transform={`translate(${ann.x}, ${ann.y})`}
            style={{ cursor: mode === "edit" ? (isEdit ? "text" : "grab") : "default" }}
            onMouseEnter={mode === "edit" ? () => setHoveredAnn(ann.id) : undefined}
            onMouseLeave={mode === "edit" ? () => setHoveredAnn(null)   : undefined}
            onMouseDown={mode === "edit" && !isEdit
              ? (e) => {
                  e.preventDefault(); e.stopPropagation();
                  const { x, y } = clientToSvg(e.clientX, e.clientY);
                  setDrag({ kind: "ann-body", id: ann.id, startX: ann.x, startY: ann.y, mouseX: x, mouseY: y });
                }
              : undefined}
            onDoubleClick={mode === "edit"
              ? (e) => { e.stopPropagation(); setEditingAnn(ann.id); setEditText(ann.text); }
              : undefined}
          >
            {/* Hit area */}
            <rect
              x={-1} y={-2.8}
              width={ann.text.length * 1.5 + 2} height={4.2}
              fill="transparent"
            />
            {/* Shadow for legibility */}
            <text
              textAnchor="start"
              dominantBaseline="central"
              fontSize={3}
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
              fill="black"
              opacity={0.45}
              dx={0.25} dy={0.25}
              style={{ pointerEvents: "none" }}
            >{ann.text}</text>
            {/* Main text */}
            <text
              textAnchor="start"
              dominantBaseline="central"
              fontSize={3}
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
              fill={color}
              style={{ pointerEvents: "none" }}
            >{ann.text}</text>
            {/* Delete button (edit mode, hovered) */}
            {mode === "edit" && isHover && !isEdit && (
              <g
                transform={`translate(${ann.text.length * 1.5 + 2.5}, -1.5)`}
                style={{ cursor: "pointer" }}
                onMouseDown={(e) => { e.stopPropagation(); onAnnotationDelete?.(ann.id); }}
              >
                <circle r={1.8} fill="#1e293b" opacity={0.85} />
                <text textAnchor="middle" dominantBaseline="central"
                  fontSize={2.4} fill="white" fontFamily="system-ui, sans-serif"
                  style={{ pointerEvents: "none" }}>×</text>
              </g>
            )}
          </g>
        );
      }

      if (ann.type === "arrow") {
        const markerId  = `ann-arrow-${ann.id}`;
        const annSw = 0.7;
        // refX=10: tip lands exactly at ann.x2 (line endpoint = tip).
        // No shortening needed — the line IS drawn to where we want the tip.
        return (
          <g
            key={ann.id}
            onMouseEnter={mode === "edit" ? () => setHoveredAnn(ann.id) : undefined}
            onMouseLeave={mode === "edit" ? () => setHoveredAnn(null)   : undefined}
          >
            {/* Dynamic arrowhead marker for this annotation's color */}
            <defs>
              <marker
                id={markerId}
                viewBox="0 0 10 10" refX="10" refY="5"
                markerWidth={MARKER_WIDTH} markerHeight={MARKER_WIDTH}
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
            </defs>

            {/* Invisible wide hit-area line */}
            <line
              x1={ann.x1} y1={ann.y1} x2={ann.x2} y2={ann.y2}
              stroke="transparent" strokeWidth={4}
              style={{ cursor: mode === "edit" ? "grab" : "default" }}
              onMouseDown={mode === "edit"
                ? (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const { x, y } = clientToSvg(e.clientX, e.clientY);
                    setDrag({ kind: "ann-body", id: ann.id,
                      startX: ann.x1, startY: ann.y1,
                      mouseX: x, mouseY: y });
                  }
                : undefined}
            />

            {/* Tip at ann.x2 — line drawn all the way to ann.x2 with refX=10 */}
            <line
              x1={ann.x1} y1={ann.y1} x2={ann.x2} y2={ann.y2}
              stroke={color} strokeWidth={annSw}
              markerEnd={`url(#${markerId})`}
              style={{ pointerEvents: "none" }}
            />

            {/* Delete button at midpoint (hovered) */}
            {mode === "edit" && isHover && (
              <g
                transform={`translate(${(ann.x1 + ann.x2) / 2}, ${(ann.y1 + ann.y2) / 2})`}
                style={{ cursor: "pointer" }}
                onMouseDown={(e) => { e.stopPropagation(); onAnnotationDelete?.(ann.id); }}
              >
                <circle r={1.8} fill="#1e293b" opacity={0.85} />
                <text textAnchor="middle" dominantBaseline="central"
                  fontSize={2.4} fill="white" fontFamily="system-ui, sans-serif"
                  style={{ pointerEvents: "none" }}>×</text>
              </g>
            )}

            {/* Endpoint drag handles */}
            {mode === "edit" && isHover && (
              <>
                <circle
                  cx={ann.x1} cy={ann.y1} r={1.5}
                  fill={color} opacity={0.8} style={{ cursor: "crosshair" }}
                  onMouseDown={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    setDrag({ kind: "ann-tail", id: ann.id });
                  }}
                />
                <circle
                  cx={ann.x2} cy={ann.y2} r={1.5}
                  fill={color} opacity={0.8} style={{ cursor: "crosshair" }}
                  onMouseDown={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    setDrag({ kind: "ann-head", id: ann.id });
                  }}
                />
              </>
            )}
          </g>
        );
      }

      return null;
    });
  }

  // ─── Overlay text editor (HTML, anchored to SVG annotation) ─────────────────

  function renderTextEditor() {
    if (!editingAnn || !svgRef.current) return null;
    const ann = current.annotations?.find(a => a.id === editingAnn && a.type === "text") as TextAnnotation | undefined;
    if (!ann) return null;

    const svg  = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const viewH = mode === "view" ? FIELD_H : VIEWBOX_H;
    const scaleX = rect.width  / VIEWBOX_W;
    const scaleY = rect.height / viewH;

    const left = rect.left + ann.x * scaleX;
    const top  = rect.top  + ann.y * scaleY - 12;

    return (
      <div
        style={{
          position: "fixed",
          left, top,
          zIndex: 50,
          background: "rgba(15,23,42,0.92)",
          border: `1.5px solid ${ANN_COLOR_MAP[ann.color]}`,
          borderRadius: 6,
          padding: "2px 6px",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={editInputRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              commitTextEdit();
            }
          }}
          onBlur={commitTextEdit}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: ANN_COLOR_MAP[ann.color],
            fontFamily: "system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 13,
            minWidth: 60,
            maxWidth: 180,
            width: Math.max(60, editText.length * 8),
          }}
        />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const viewH = mode === "view" ? FIELD_H : VIEWBOX_H;
  const cursor = annotationTool && mode === "edit" ? "crosshair" : "default";

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_W} ${viewH}`}
        width="100%"
        height="auto"
        style={{ display: "block", userSelect: "none", cursor }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleSvgClick}
      >
        {/* ── Defs ── */}
        <defs>
          {(
            [
              ["arrow-offense", COLOR_OFFENSE],
              ["arrow-defense", COLOR_DEFENSE],
            ] as const
          ).map(([id, color]) => (
            <marker key={id} id={id}
              viewBox="0 0 10 10" refX="10" refY="5"
              markerWidth={MARKER_WIDTH} markerHeight={MARKER_WIDTH}
              orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          ))}
          <marker id="arrow-disc"
            viewBox="0 0 10 10" refX="10" refY="5"
            markerWidth={MARKER_WIDTH} markerHeight={MARKER_WIDTH}
            orient="auto-start-reverse">
            <path d="M 1 1 L 9 5 L 1 9" fill="none"
              stroke={COLOR_ARROW_DISC} strokeWidth="1.8" strokeLinejoin="round" />
          </marker>
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
        <rect x={0} y={0} width={VIEWBOX_W} height={FIELD_H}
          fill="none" stroke="white" strokeWidth={0.5} />
        <line x1={20} y1={0} x2={20} y2={FIELD_H} stroke="white" strokeWidth={0.5} />
        <line x1={90} y1={0} x2={90} y2={FIELD_H} stroke="white" strokeWidth={0.5} />
        {[40, 70].map((bx) => (
          <g key={bx}>
            <line x1={bx-0.7} y1={20-0.7} x2={bx+0.7} y2={20+0.7} stroke="white" strokeWidth={0.4} />
            <line x1={bx+0.7} y1={20-0.7} x2={bx-0.7} y2={20+0.7} stroke="white" strokeWidth={0.4} />
          </g>
        ))}

        {/* ── Staging area ── */}
        {mode === "edit" && (
          <>
            <rect x={0} y={FIELD_H} width={VIEWBOX_W} height={VIEWBOX_H - FIELD_H} fill="#1e293b" />
            <text x={VIEWBOX_W / 2} y={VIEWBOX_H - 1.5}
              textAnchor="middle" fill="#94a3b8" fontSize={2.2}
              fontFamily="system-ui, sans-serif">
              Drag players onto the field
            </text>
          </>
        )}

        {/* ── Route arrows ── */}
        {renderArrows()}

        {/* ── Annotations (above arrows, below players) ── */}
        {renderAnnotations()}

        {/* ── Branch handles ── */}
        {renderBranchHandles()}

        {/* ── Offense players ── */}
        {current.offense.map((p, i) => (
          <g key={`o-${i}`}
            transform={`translate(${p.x}, ${p.y})`}
            style={{
              cursor: mode === "edit" && !annotationTool ? "grab" : (annotationTool ? "crosshair" : "default"),
              ...(mode === "view" ? { transition: "transform 0.8s ease" } : {}),
            }}
            onMouseDown={!annotationTool
              ? handleMouseDown({ team: "offense", index: i, kind: "player" })
              : undefined}>
            {p.highlight && (
              <circle r={HIGHLIGHT_R} fill={COLOR_OFFENSE} opacity={0.35}
                filter="url(#glow)"
                style={mode === "view" ? { animation: "pulse 1.2s ease-in-out infinite" } : undefined} />
            )}
            <circle r={PLAYER_R} fill={COLOR_OFFENSE} />
            <text textAnchor="middle" dominantBaseline="central"
              fill="white" fontSize={1.6} fontWeight="bold"
              fontFamily="system-ui, sans-serif"
              style={{ pointerEvents: "none" }}>{p.label}</text>
          </g>
        ))}

        {/* ── Defense players ── */}
        {current.defense.map((p, i) => (
          <g key={`d-${i}`}
            transform={`translate(${p.x}, ${p.y})`}
            style={{
              cursor: mode === "edit" && !annotationTool ? "grab" : (annotationTool ? "crosshair" : "default"),
              ...(mode === "view" ? { transition: "transform 0.8s ease" } : {}),
            }}
            onMouseDown={!annotationTool
              ? handleMouseDown({ team: "defense", index: i, kind: "player" })
              : undefined}>
            {p.highlight && (
              <circle r={HIGHLIGHT_R} fill={COLOR_DEFENSE} opacity={0.35}
                filter="url(#glow)"
                style={mode === "view" ? { animation: "pulse 1.2s ease-in-out infinite" } : undefined} />
            )}
            <circle r={PLAYER_R} fill={COLOR_DEFENSE} />
            <text textAnchor="middle" dominantBaseline="central"
              fill="white" fontSize={1.6} fontWeight="bold"
              fontFamily="system-ui, sans-serif"
              style={{ pointerEvents: "none" }}>{p.label}</text>
          </g>
        ))}

        {/* ── Disc ── */}
        <g
          transform={`translate(${current.disc.x}, ${current.disc.y})`}
          style={{
            cursor: mode === "edit" && !annotationTool ? "grab" : (annotationTool ? "crosshair" : "default"),
            ...(mode === "view" ? { transition: "transform 0.8s ease" } : {}),
          }}
          onMouseDown={!annotationTool
            ? handleMouseDown({ team: "disc", index: 0, kind: "player" })
            : undefined}>
          <circle r={DISC_R} fill="white" stroke={COLOR_DISC_STROKE} strokeWidth={0.5} />
        </g>
      </svg>

      {/* ── Floating text editor overlay ── */}
      {renderTextEditor()}

      {/* ── Notes panel (view mode) ── */}
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
          minHeight: "42px",
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
