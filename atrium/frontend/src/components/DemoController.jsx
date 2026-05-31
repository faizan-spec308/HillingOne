import { useState } from "react";
import { Play, Bot, AlertTriangle, RotateCcw, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../api/client";

export default function DemoController({ onAgentRun, onScenarioComplete }) {
  const [expanded, setExpanded] = useState(true);
  const [running, setRunning] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const runScenario = async (key, fn) => {
    setRunning(key);
    setLastResult(null);
    try {
      const result = await fn();
      setLastResult({ key, ok: true, message: summarise(key, result) });
      if (key === "agent" && result.agent_result) {
        onAgentRun?.(result.agent_result);
      }
      onScenarioComplete?.(key, result);
    } catch (err) {
      setLastResult({ key, ok: false, message: err.message });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-30 w-72 bg-white border-2 border-hillingdon-navy rounded-xl shadow-xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-hillingdon-navy text-white rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} />
          <span className="text-sm font-semibold">Demo Controller</span>
        </div>
        {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {expanded && (
        <div className="p-3 space-y-2">
          <DemoButton
            icon={<Bot size={14} />}
            label="Run AGENT: Councillor swap"
            description="Triggers autonomous agent. Watch its reasoning panel."
            running={running === "agent"}
            onClick={() => runScenario("agent", api.runScenarioAgentSwap)}
            primary
          />
          <DemoButton
            icon={<AlertTriangle size={14} />}
            label="Run override: flooded room"
            description="Staff cancels with reason, alternative offered, credit applied."
            running={running === "override"}
            onClick={() => runScenario("override", api.runScenarioOverride)}
          />
          <DemoButton
            icon={<RotateCcw size={14} />}
            label="Reset demo state"
            description="Clears any pending swaps."
            running={running === "reset"}
            onClick={() => runScenario("reset", api.resetDemo)}
          />

          {lastResult && (
            <div className={`text-xs p-2 rounded ${lastResult.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
              {lastResult.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DemoButton({ icon, label, description, running, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      disabled={!!running}
      className={`w-full text-left p-2.5 rounded-lg border transition disabled:opacity-50 ${
        primary
          ? "border-hillingdon-navy bg-hillingdon-navy-tint hover:bg-hillingdon-navy/10"
          : "border-gray-200 hover:border-hillingdon-navy hover:bg-hillingdon-navy-tint"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
        {running ? <Play size={14} className="animate-pulse" /> : icon}
        {label}
      </div>
      <div className="text-xs text-gray-600 mt-0.5">{description}</div>
    </button>
  );
}

function summarise(key, result) {
  if (key === "agent") {
    const r = result.agent_result;
    return `Agent ran ${r.iterations_used} steps, decision: ${r.final_decision}`;
  }
  if (key === "override") {
    return `Override executed. Resident notified with ${result.override_result.goodwill_credit_applied}% credit.`;
  }
  if (key === "reset") {
    return "Demo state reset.";
  }
  return "Done.";
}
