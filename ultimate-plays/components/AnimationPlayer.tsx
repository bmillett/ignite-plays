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

export default function AnimationPlayer({
  steps,
  playId,
}: AnimationPlayerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastStep = steps.length - 1;

  // Advance step on interval while playing
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
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, lastStep]);

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

  return (
    <div className="flex flex-col gap-4">
      {/* Field */}
      <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-900">
        <FieldCanvas steps={steps} currentStep={currentStep} mode="view" />
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

        {/* Buttons + step indicator row */}
        <div className="flex items-center gap-2 sm:gap-3">
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

          {/* Reset */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 8a6 6 0 1 1 1.5 4" strokeLinecap="round" />
              <path d="M2 12V8h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reset
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
