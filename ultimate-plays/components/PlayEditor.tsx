"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FieldCanvas, {
  defaultStepPositions,
  StepPositions,
  Annotation,
  AnnotationColor,
  AnnotationToolMode,
} from "@/components/FieldCanvas";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InitialPlay {
  id: number;
  name: string;
  description: string;
  tags: string[];
  steps: StepPositions[];
}

interface PlayEditorProps {
  initialPlay?: InitialPlay;
}

// ─── Annotation colour palette ────────────────────────────────────────────────
const ANN_COLORS: { value: AnnotationColor; hex: string; label: string }[] = [
  { value: "white",  hex: "#ffffff", label: "White"  },
  { value: "yellow", hex: "#facc15", label: "Yellow" },
  { value: "red",    hex: "#f87171", label: "Red"    },
  { value: "cyan",   hex: "#22d3ee", label: "Cyan"   },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlayEditor({ initialPlay }: PlayEditorProps) {
  const router = useRouter();

  const [name, setName]               = useState(initialPlay?.name ?? "");
  const [description, setDescription] = useState(initialPlay?.description ?? "");
  const [tags, setTags]               = useState<string[]>(initialPlay?.tags ?? []);
  const [steps, setSteps]             = useState<StepPositions[]>(
    initialPlay?.steps && initialPlay.steps.length > 0
      ? initialPlay.steps
      : [defaultStepPositions()]
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [isDirty, setIsDirty]         = useState(false);

  // Tag autocomplete
  const [allTags, setAllTags]             = useState<string[]>([]);
  const [tagInput, setTagInput]           = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Annotation toolbar
  const [annTool, setAnnTool]         = useState<AnnotationToolMode>(null);
  const [annColor, setAnnColor]       = useState<AnnotationColor>("white");
  const [keepAnnotations, setKeepAnnotations] = useState(false);

  // Add-step popover
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data: { id: number; name: string }[]) =>
        setAllTags(data.map((t) => t.name))
      )
      .catch(() => {});
  }, []);

  // beforeunload guard
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Deactivate tool when changing steps
  useEffect(() => {
    setAnnTool(null);
  }, [currentStep]);

  // ─── Field canvas callbacks ───────────────────────────────────────────────

  const handlePositionChange = useCallback(
    (team: "offense" | "defense" | "disc", playerIndex: number, x: number, y: number) => {
      setIsDirty(true);
      setSteps((prev) => prev.map((s, i) => {
        if (i !== currentStep) return s;
        if (team === "disc") return { ...s, disc: { x, y } };
        const players = [...s[team]];
        players[playerIndex] = { ...players[playerIndex], x, y };
        return { ...s, [team]: players };
      }));
    },
    [currentStep]
  );

  const handleBranchChange = useCallback(
    (team: "offense" | "defense", playerIndex: number, x: number, y: number) => {
      setIsDirty(true);
      setSteps((prev) => prev.map((s, i) => {
        if (i !== currentStep) return s;
        const players = [...s[team]];
        players[playerIndex] = { ...players[playerIndex], branch: { x, y } };
        return { ...s, [team]: players };
      }));
    },
    [currentStep]
  );

  // ─── Annotation callbacks ─────────────────────────────────────────────────

  const handleAnnotationAdd = useCallback(
    (ann: Annotation) => {
      setIsDirty(true);
      setSteps((prev) => prev.map((s, i) => {
        if (i !== currentStep) return s;
        return { ...s, annotations: [...(s.annotations ?? []), ann] };
      }));
    },
    [currentStep]
  );

  const handleAnnotationMove = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      setIsDirty(true);
      setSteps((prev) => prev.map((s, i) => {
        if (i !== currentStep) return s;
        return {
          ...s,
          annotations: (s.annotations ?? []).map((a) =>
            a.id === id ? { ...a, ...patch } as Annotation : a
          ),
        };
      }));
    },
    [currentStep]
  );

  const handleAnnotationDelete = useCallback(
    (id: string) => {
      setIsDirty(true);
      setSteps((prev) => prev.map((s, i) => {
        if (i !== currentStep) return s;
        return { ...s, annotations: (s.annotations ?? []).filter((a) => a.id !== id) };
      }));
    },
    [currentStep]
  );

  const handleAnnotationTextEdit = useCallback(
    (id: string, text: string) => {
      setIsDirty(true);
      setSteps((prev) => prev.map((s, i) => {
        if (i !== currentStep) return s;
        return {
          ...s,
          annotations: (s.annotations ?? []).map((a) =>
            a.id === id && a.type === "text" ? { ...a, text } : a
          ),
        };
      }));
    },
    [currentStep]
  );

  // ─── Toggle highlight ────────────────────────────────────────────────────

  function toggleHighlight(team: "offense" | "defense", playerIndex: number) {
    setIsDirty(true);
    setSteps((prev) => prev.map((s, i) => {
      if (i !== currentStep) return s;
      const players = [...s[team]];
      players[playerIndex] = { ...players[playerIndex], highlight: !players[playerIndex].highlight };
      return { ...s, [team]: players };
    }));
  }

  // ─── Branch ──────────────────────────────────────────────────────────────

  function addBranch(team: "offense" | "defense", playerIndex: number) {
    setIsDirty(true);
    setSteps((prev) => prev.map((s, i) => {
      if (i !== currentStep) return s;
      const players = [...s[team]];
      const p = players[playerIndex];
      players[playerIndex] = { ...p, branch: { x: Math.min(p.x + 8, 108), y: Math.max(p.y - 4, 2) } };
      return { ...s, [team]: players };
    }));
  }

  function removeBranch(team: "offense" | "defense", playerIndex: number) {
    setIsDirty(true);
    setSteps((prev) => prev.map((s, i) => {
      if (i !== currentStep) return s;
      const players = [...s[team]];
      const { branch: _removed, ...rest } = players[playerIndex];
      players[playerIndex] = rest;
      return { ...s, [team]: players };
    }));
  }

  // ─── Step management ─────────────────────────────────────────────────────

  function insertStepAfter(sourceIdx: number) {
    setIsDirty(true);
    setShowAddMenu(false);
    setSteps((prev) => {
      const cloned: StepPositions = JSON.parse(JSON.stringify(prev[sourceIdx]));
      delete cloned.note;
      if (!keepAnnotations) delete cloned.annotations;
      // Strip branch arrows from all players — they belong to a specific step
      cloned.offense = cloned.offense.map(({ branch: _b, ...p }) => p);
      cloned.defense = cloned.defense.map(({ branch: _b, ...p }) => p);
      const next = [...prev];
      next.splice(currentStep + 1, 0, cloned);
      return next;
    });
    setCurrentStep((prev) => prev + 1);
  }

  function removeStep() {
    if (steps.length <= 1) return;
    setIsDirty(true);
    setSteps((prev) => prev.filter((_, i) => i !== currentStep));
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }

  // ─── Tag management ──────────────────────────────────────────────────────

  const filteredSuggestions = allTags.filter(
    (t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t) && tagInput.length > 0
  );

  function addTag(value: string) {
    const trimmed = value.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setTagInput("");
    setShowSuggestions(false);
    setIsDirty(true);
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
    setIsDirty(true);
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredSuggestions.length > 0) addTag(filteredSuggestions[0]);
      else if (tagInput.trim()) addTag(tagInput);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!name.trim()) { setError("Play name is required."); return; }
    setError(null);
    setSaving(true);
    try {
      const body = { name, description, tags, steps };
      const isEdit = !!initialPlay;
      const url    = isEdit ? `/api/plays/${initialPlay!.id}` : "/api/plays";
      const method = isEdit ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      const data = await res.json();
      setIsDirty(false);
      router.push(`/plays/${isEdit ? initialPlay!.id : data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  // ─── Annotation toolbar helpers ───────────────────────────────────────────

  function activateTool(type: "text" | "arrow") {
    const active = annTool?.type === type;
    setAnnTool(active ? null : { type, color: annColor });
  }

  function updateToolColor(color: AnnotationColor) {
    setAnnColor(color);
    if (annTool) setAnnTool({ ...annTool, color });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* ── Left: Field canvas ── */}
      <div className="flex-1 min-w-0 p-4 flex items-start">
        <div className="w-full">
          <FieldCanvas
            steps={steps}
            currentStep={currentStep}
            mode="edit"
            annotationTool={annTool}
            onAnnotationAdd={handleAnnotationAdd}
            onAnnotationMove={handleAnnotationMove}
            onAnnotationDelete={handleAnnotationDelete}
            onAnnotationTextEdit={handleAnnotationTextEdit}
            onPositionChange={handlePositionChange}
            onBranchChange={handleBranchChange}
          />
        </div>
      </div>

      {/* ── Right: Sidebar ── */}
      <aside className="w-72 shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Play metadata */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Play Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setIsDirty(true); }}
                placeholder="e.g. Vertical Stack"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }}
                placeholder="Optional description…"
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Tags
              </label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {tags.map((tag) => (
                    <span key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)}
                        className="text-blue-400 hover:text-blue-700 leading-none"
                        aria-label={`Remove tag ${tag}`}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={tagInput}
                  onChange={(e) => { setTagInput(e.target.value); setShowSuggestions(true); }}
                  onKeyDown={handleTagKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Add tag…"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <ul className="absolute z-10 w-full mt-1 rounded-md border border-gray-200 bg-white shadow-md text-sm overflow-hidden">
                    {filteredSuggestions.map((s) => (
                      <li key={s}>
                        <button type="button" onMouseDown={() => addTag(s)}
                          className="w-full text-left px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Step list */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Steps
            </label>
            <div className="space-y-1">
              {steps.map((_, i) => (
                <button key={i} type="button" onClick={() => setCurrentStep(i)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    i === currentStep
                      ? "bg-blue-600 text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}>
                  Step {i + 1}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              {/* Add Step — popover with "after current" + "copy from" options */}
              <div className="flex-1 relative" ref={addMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowAddMenu((v) => !v)}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                >
                  + Add Step
                  <svg viewBox="0 0 10 6" width="8" height="8" fill="currentColor" className="opacity-50">
                    <path d="M0 0l5 6 5-6H0z" />
                  </svg>
                </button>

                {showAddMenu && (
                  <div className="absolute left-0 top-full mt-1 w-52 rounded-lg border border-gray-200 bg-white shadow-lg z-20 overflow-hidden">
                    {/* Close on outside click */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowAddMenu(false)}
                    />
                    <div className="relative z-20">
                      {/* After current step */}
                      <button
                        type="button"
                        onClick={() => insertStepAfter(currentStep)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-gray-100"
                      >
                        ＋ After Step {currentStep + 1} <span className="font-normal text-gray-400">(copy current)</span>
                      </button>

                      {/* Copy from any step */}
                      {steps.length > 1 && (
                        <>
                          <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            Copy from…
                          </p>
                          {steps.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => insertStepAfter(i)}
                              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                                i === currentStep
                                  ? "text-gray-400 cursor-default"
                                  : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                              }`}
                            >
                              Step {i + 1}
                              {i === currentStep && (
                                <span className="ml-1 text-gray-400">(current)</span>
                              )}
                              {steps[i].note && (
                                <span className="ml-1 text-gray-400 truncate">
                                  — {steps[i].note!.slice(0, 20)}{steps[i].note!.length > 20 ? "…" : ""}
                                </span>
                              )}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button type="button" onClick={removeStep} disabled={steps.length <= 1}
                className="flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                − Remove
              </button>
            </div>
            {/* Keep annotations checkbox */}
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepAnnotations}
                onChange={(e) => setKeepAnnotations(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">Keep annotations on next step</span>
            </label>
          </div>

          <hr className="border-gray-200" />

          {/* Annotation toolbar */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Annotations — Step {currentStep + 1}
            </label>

            {/* Tool buttons */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => activateTool("text")}
                title="Add text label — click on field to place"
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                  annTool?.type === "text"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="text-base leading-none">T</span> Text
              </button>
              <button
                type="button"
                onClick={() => activateTool("arrow")}
                title="Add arrow — click on field to place"
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
                  annTool?.type === "arrow"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M2 8h10" />
                  <path d="M9 5l3 3-3 3" />
                </svg>
                Arrow
              </button>
            </div>

            {/* Active tool hint */}
            {annTool && (
              <p className="text-xs text-blue-600 mb-2 font-medium">
                {annTool.type === "text"
                  ? "Click on the field to place a text label"
                  : "Click on the field to place an arrow"}
                {" "}— click again to cancel
              </p>
            )}

            {/* Color swatches */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Colour:</span>
              {ANN_COLORS.map(({ value, hex, label }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onClick={() => updateToolColor(value)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${
                    annColor === value
                      ? "border-blue-500 scale-110"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                  style={{ background: hex }}
                />
              ))}
            </div>

            {/* Current step annotation count */}
            {(steps[currentStep].annotations?.length ?? 0) > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                {steps[currentStep].annotations!.length} annotation{steps[currentStep].annotations!.length !== 1 ? "s" : ""} on this step
                {" · "}
                <button
                  type="button"
                  className="text-red-400 hover:text-red-600 transition-colors"
                  onClick={() => {
                    setIsDirty(true);
                    setSteps((prev) => prev.map((s, i) =>
                      i === currentStep ? { ...s, annotations: [] } : s
                    ));
                  }}
                >
                  clear all
                </button>
              </p>
            )}
          </div>

          <hr className="border-gray-200" />

          {/* Step note */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Step {currentStep + 1} Note
            </label>
            <textarea
              value={steps[currentStep].note ?? ""}
              onChange={(e) => {
                setIsDirty(true);
                const note = e.target.value;
                setSteps((prev) => prev.map((s, i) => i === currentStep ? { ...s, note } : s));
              }}
              placeholder="Optional coaching note shown during playback…"
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          <hr className="border-gray-200" />

          {/* Player controls */}
          {currentStep > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Player Options — Step {currentStep + 1}
              </label>
              <p className="text-xs text-gray-400 mb-2">⭐ highlight a key player · ⑂ add an optional cut</p>

              {/* Offense */}
              <div className="mb-2">
                <p className="text-xs font-medium text-blue-600 mb-1">Offense</p>
                <div className="space-y-1">
                  {steps[currentStep].offense.map((p, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="w-7 text-xs font-mono text-gray-600">{p.label}</span>
                      <button type="button" title="Highlight player"
                        onClick={() => toggleHighlight("offense", i)}
                        className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                          p.highlight ? "bg-yellow-400 text-yellow-900" : "bg-gray-100 text-gray-400 hover:bg-yellow-100"
                        }`}>⭐</button>
                      {p.branch ? (
                        <button type="button" title="Remove optional cut"
                          onClick={() => removeBranch("offense", i)}
                          className="rounded px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 hover:bg-red-100 hover:text-red-600 transition-colors">
                          ⑂ remove
                        </button>
                      ) : (
                        <button type="button" title="Add optional cut"
                          onClick={() => addBranch("offense", i)}
                          className="rounded px-1.5 py-0.5 text-xs bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-700 transition-colors">
                          ⑂ add cut
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Defense */}
              <div>
                <p className="text-xs font-medium text-red-500 mb-1">Defense</p>
                <div className="space-y-1">
                  {steps[currentStep].defense.map((p, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="w-7 text-xs font-mono text-gray-600">{p.label}</span>
                      <button type="button" title="Highlight player"
                        onClick={() => toggleHighlight("defense", i)}
                        className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                          p.highlight ? "bg-yellow-400 text-yellow-900" : "bg-gray-100 text-gray-400 hover:bg-yellow-100"
                        }`}>⭐</button>
                      {p.branch ? (
                        <button type="button" title="Remove optional cut"
                          onClick={() => removeBranch("defense", i)}
                          className="rounded px-1.5 py-0.5 text-xs bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                          ⑂ remove
                        </button>
                      ) : (
                        <button type="button" title="Add optional cut"
                          onClick={() => addBranch("defense", i)}
                          className="rounded px-1.5 py-0.5 text-xs bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                          ⑂ add cut
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Save footer ── */}
        <div className="shrink-0 border-t border-gray-200 p-4 space-y-2">
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {saving && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {saving ? "Saving…" : "Save Play"}
          </button>
        </div>
      </aside>
    </div>
  );
}
