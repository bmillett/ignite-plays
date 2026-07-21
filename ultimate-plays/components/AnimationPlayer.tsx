"use client";

import { useEffect, useRef, useState } from "react";
import FieldCanvas from "@/components/FieldCanvas";
import type { StepPositions } from "@/components/FieldCanvas";

interface AnimationPlayerProps {
  steps: StepPositions[];
  playName: string;
  playId: number;
  tags: string[];
}

const SPEEDS = [
  { label: "Slow",   ms: 1800 },
  { label: "Normal", ms: 1000 },
  { label: "Fast",   ms: 450  },
] as const;

type SpeedLabel = typeof SPEEDS[number]["label"];

export default function AnimationPlayer({
  steps,
  playId,
}: AnimationPlayerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedLabel>("Normal");
  const [showTracks, setShowTracks] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastStep = steps.length - 1;
  const intervalMs = SPEEDS.find((s) => s.label === speed)!.ms;

  // Advance step on interval while playing — restarts when speed changes
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= lastStep) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, lastStep, intervalMs]);

  function handlePlayPause() {
    if (currentStep >= lastStep && !isPlaying) {
      // Already at end — reset then play
      setCurrentStep(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((p) => !p);
    }
  }

  function handleReset() {
    setIsPlaying(false);
    setCurrentStep(0);
  }

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    setIsPlaying(false);
    setCurrentStep(Number(e.target.value));
  }

  function handleStepBack() {
    setIsPlaying(false);
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }

  function handleStepForward() {
    setIsPlaying(false);
    setCurrentStep((prev) => Math.min(lastStep, prev + 1));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Field */}
      <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-900">
        <FieldCanvas steps={steps} currentStep={currentStep} mode="view" showTracks={showTracks} />
      </div>

      {/* Control bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 sm:px-5">
        {/* Scrubber — full width, on top for easy thumb access on mobile */}
        <input
          type="range"
          min={0}
          max={lastStep}
          value={currentStep}
          onChange={handleScrub}
          className="w-full accent-blue-600 h-2 cursor-pointer"
        />

        {/* Buttons + speed + step indicator row */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Play / Pause */}
          <button
            onClick={handlePlayPause}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors min-w-[84px] justify-center"
          >
            {isPlaying ? (
              <>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <rect x="3" y="2" width="4" height="12" rx="1" />
                  <rect x="9" y="2" width="4" height="12" rx="1" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path d="M4 2l10 6-10 6V2z" />
                </svg>
                Play
              </>
            )}
          </button>

          {/* Step back */}
          <button
            onClick={handleStepBack}
            disabled={currentStep === 0}
            title="Previous step"
            className="flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M10 3L5 8l5 5V3z" />
              <rect x="3" y="3" width="2" height="10" rx="1" />
            </svg>
          </button>

          {/* Step forward */}
          <button
            onClick={handleStepForward}
            disabled={currentStep === lastStep}
            title="Next step"
            className="flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M6 3l5 5-5 5V3z" />
              <rect x="11" y="3" width="2" height="10" rx="1" />
            </svg>
          </button>

          {/* Reset */}
          <button
            onClick={handleReset}
            title="Reset to start"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 8a6 6 0 1 1 1.5 4" strokeLinecap="round" />
              <path d="M2 12V8h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reset
          </button>

          {/* Speed selector */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-xs font-medium">
            {SPEEDS.map((s) => (
              <button
                key={s.label}
                onClick={() => setSpeed(s.label)}
                className={`px-2.5 py-2 transition-colors ${
                  speed === s.label
                    ? "bg-gray-700 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Tracks toggle */}
          <button
            onClick={() => setShowTracks((t) => !t)}
            title={showTracks ? "Hide ghost tracks" : "Show ghost tracks"}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
              showTracks
                ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 8 Q5 4 8 8 Q11 12 14 8" />
              <path d="M2 11 Q5 7 8 11 Q11 15 14 11" opacity="0.4" />
            </svg>
            Tracks
          </button>

          {/* Step indicator */}
          <span className="ml-auto text-sm text-gray-500 tabular-nums whitespace-nowrap">
            Step{" "}
            <span className="font-semibold text-gray-800">{currentStep + 1}</span>
            {" "}of{" "}
            <span className="font-semibold text-gray-800">{steps.length}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
