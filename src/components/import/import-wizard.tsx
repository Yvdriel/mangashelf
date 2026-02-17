"use client";

import { useState, useCallback } from "react";
import { SourceSelector } from "./source-selector";
import { ImportAnalysisView } from "./import-analysis";
import { ImportConfirmation } from "./import-confirmation";
import { ImportProgress } from "./import-progress";
import { ImportHistory } from "./import-history";
import type { ImportAnalysis } from "@/lib/import-types";

type WizardStep = 1 | 2 | 3 | 4;

interface VolumeConfig {
  id: string;
  volumeNumber: number;
  action: "import" | "skip" | "replace";
  included: boolean;
}

interface AniListMatch {
  anilistId: number;
  title: string;
  coverUrl: string;
  totalVolumes: number | null;
}

export function ImportWizard() {
  const [step, setStep] = useState<WizardStep>(1);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [volumeConfigs, setVolumeConfigs] = useState<VolumeConfig[]>([]);
  const [anilistMatch, setAnilistMatch] = useState<AniListMatch | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [importId, setImportId] = useState<string | null>(null);
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const [addToManager, setAddToManager] = useState(true);
  const [monitor, setMonitor] = useState(true);

  const steps = [
    { num: 1, label: "Source" },
    { num: 2, label: "Review" },
    { num: 3, label: "Confirm" },
    { num: 4, label: "Import" },
  ];

  const handleAnalysisComplete = useCallback((result: ImportAnalysis) => {
    setAnalysis(result);

    // Initialize volume configs from analysis
    const configs: VolumeConfig[] = result.volumes.map((v) => ({
      id: v.id,
      volumeNumber: v.detectedVolumeNumber ?? 0,
      action: v.existsInLibrary ? ("skip" as const) : ("import" as const),
      included: !v.existsInLibrary && v.pageCount > 0,
    }));
    setVolumeConfigs(configs);

    // Set initial AniList match from analysis
    if (result.suggestedMatch) {
      setAnilistMatch(result.suggestedMatch);
      setManualTitle(result.suggestedMatch.title);
    } else if (result.titleGuess) {
      setManualTitle(result.titleGuess);
    }

    setStep(2);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!analysis) return;

    const title = anilistMatch?.title || manualTitle;
    if (!title) return;

    const volumes = volumeConfigs
      .filter((v) => v.included)
      .map((v) => ({
        id: v.id,
        volumeNumber: v.volumeNumber,
        action: v.action,
      }));

    const res = await fetch("/api/import/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: analysis.sessionId,
        title,
        anilistId: anilistMatch?.anilistId,
        volumes,
        mode,
        addToManager: addToManager && !!anilistMatch,
        monitor: monitor && addToManager && !!anilistMatch,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to start import");
      return;
    }

    const { importId: id } = await res.json();
    setImportId(id);
    setStep(4);
  }, [
    analysis,
    anilistMatch,
    manualTitle,
    volumeConfigs,
    mode,
    addToManager,
    monitor,
  ]);

  const handleReset = useCallback(() => {
    setStep(1);
    setAnalysis(null);
    setVolumeConfigs([]);
    setAnilistMatch(null);
    setManualTitle("");
    setImportId(null);
    setMode("copy");
    setAddToManager(true);
    setMonitor(true);
  }, []);

  const importableCount = volumeConfigs.filter(
    (v) => v.included && v.volumeNumber > 0,
  ).length;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-surface-50">
          Manual Import
        </h1>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  s.num === step
                    ? "bg-accent-400/15 text-accent-300"
                    : s.num < step
                      ? "bg-surface-600 text-surface-100"
                      : "bg-surface-700 text-surface-300"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.num < step
                      ? "bg-accent-400 text-surface-900"
                      : s.num === step
                        ? "bg-accent-400/30 text-accent-300"
                        : "bg-surface-500 text-surface-300"
                  }`}
                >
                  {s.num < step ? "✓" : s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`mx-1 h-px w-6 ${
                    s.num < step ? "bg-accent-400/40" : "bg-surface-600"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Back button */}
      {step > 1 && step < 4 && (
        <button
          onClick={() => setStep((s) => (s - 1) as WizardStep)}
          className="flex items-center gap-1 text-sm text-surface-200 hover:text-surface-50 transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </button>
      )}

      {/* Step content */}
      {step === 1 && (
        <SourceSelector onAnalysisComplete={handleAnalysisComplete} />
      )}

      {step === 2 && analysis && (
        <ImportAnalysisView
          analysis={analysis}
          volumeConfigs={volumeConfigs}
          onVolumeConfigsChange={setVolumeConfigs}
          anilistMatch={anilistMatch}
          onAnilistMatchChange={setAnilistMatch}
          manualTitle={manualTitle}
          onManualTitleChange={setManualTitle}
          onContinue={() => setStep(3)}
          canContinue={importableCount > 0 && !!(anilistMatch || manualTitle)}
          initialSearchQuery={
            !analysis.suggestedMatch ? analysis.titleGuess : undefined
          }
        />
      )}

      {step === 3 && analysis && (
        <ImportConfirmation
          analysis={analysis}
          volumeConfigs={volumeConfigs}
          anilistMatch={anilistMatch}
          manualTitle={manualTitle}
          mode={mode}
          onModeChange={setMode}
          addToManager={addToManager}
          onAddToManagerChange={setAddToManager}
          monitor={monitor}
          onMonitorChange={setMonitor}
          onConfirm={handleConfirm}
        />
      )}

      {step === 4 && importId && (
        <ImportProgress importId={importId} onReset={handleReset} />
      )}

      {/* Import history */}
      {step === 1 && (
        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold text-surface-50">
            Import History
          </h2>
          <ImportHistory />
        </div>
      )}
    </div>
  );
}
