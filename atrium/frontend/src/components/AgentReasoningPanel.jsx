import { useEffect, useState } from "react";
import { Bot, X, ArrowRight, CheckCircle2, AlertTriangle, Cpu } from "lucide-react";

/**
 * The component that wins the pitch.
 *
 * Renders the agent's reasoning steps live as it works through a problem.
 * Each step appears with a small delay so the judges can read it.
 */
export default function AgentReasoningPanel({ run, onClose }) {
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    if (!run) {
      setVisibleSteps(0);
      return;
    }
    setVisibleSteps(0);
    const total = (run.steps || []).length;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setVisibleSteps(i);
      if (i >= total) clearInterval(interval);
    }, 600);
    return () => clearInterval(interval);
  }, [run]);

  if (!run) return null;

  const steps = run.steps || [];
  const shown = steps.slice(0, visibleSteps);
  const isLive = visibleSteps < steps.length;

  return (
    <div className="fixed top-0 right-0 h-full w-full md:w-[460px] bg-white border-l border-gray-200 shadow-2xl z-40 flex flex-col">
      {/* Header */}
      <div className="bg-hillingdon-navy text-white p-5 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center">
            <Bot size={20} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-75">
              Agentic AI · Gemini 2.5 Flash
            </div>
            <h3 className="text-lg font-semibold">Conflict Resolution Agent</h3>
            <p className="text-xs opacity-75 mt-0.5">
              Autonomously deciding which tools to call
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close agent panel"
          className="p-1.5 hover:bg-white/10 rounded transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Goal */}
      <div className="px-5 py-3 bg-hillingdon-navy-tint border-b border-gray-200">
        <div className="text-[10px] uppercase tracking-wider text-hillingdon-navy font-semibold mb-1">
          Goal
        </div>
        <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">
          {run.goal_summary || run.goal || "Resolve the booking conflict respectfully and intelligently."}
        </p>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {shown.map((step, idx) => (
          <AgentStep key={`${step.step}-${step.type}-${idx}`} step={step} />
        ))}

        {isLive && (
          <div className="flex items-center gap-2 text-sm text-gray-500 pl-2 pulse-subtle">
            <Cpu size={14} />
            <span>Agent thinking...</span>
          </div>
        )}

        {!isLive && run.final_decision && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={18} className="text-emerald-700" />
              <span className="font-semibold text-emerald-900">
                Final decision: {run.final_decision.replace(/_/g, " ")}
              </span>
            </div>
            <div className="text-xs text-emerald-800">
              Iterations used: {run.iterations_used} · Tools called:{" "}
              {steps.filter((s) => s.type === "tool_call").length}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 bg-gray-50 text-xs text-gray-600">
        <div className="font-medium text-gray-900 mb-1">
          The agent suggests. The human decides.
        </div>
        <p className="leading-relaxed">
          Every step is logged. The agent never cancels confirmed bookings. It can only
          ask the resident to consider a swap, with goodwill credit, and full right to decline.
        </p>
      </div>
    </div>
  );
}

function AgentStep({ step }) {
  if (step.type === "tool_call") {
    return (
      <div className="agent-step">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-6 h-6 bg-hillingdon-navy text-white rounded-full text-xs flex items-center justify-center font-semibold">
            {step.step}
          </span>
          <span className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
            Calling tool
          </span>
        </div>
        <div className="ml-8 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <code className="text-sm font-mono text-hillingdon-navy font-semibold">
            {step.tool}()
          </code>
          {step.args && Object.keys(step.args).length > 0 && (
            <div className="mt-2 space-y-0.5">
              {Object.entries(step.args).map(([k, v]) => (
                <div key={k} className="text-xs font-mono text-gray-600">
                  <span className="text-gray-400">{k}:</span>{" "}
                  <span className="text-gray-900">{formatArg(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step.type === "tool_result") {
    const result = step.result || {};
    const isError = !!result.error;
    return (
      <div className="agent-step ml-8">
        <div className="flex items-start gap-2">
          <ArrowRight size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div className={`flex-1 text-xs rounded-md p-2 ${isError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>
            <div className="font-semibold mb-0.5">Result</div>
            <div className="font-mono leading-relaxed break-words">
              {summariseResult(result)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step.type === "agent_thought") {
    return (
      <div className="agent-step ml-8 text-xs text-gray-600 italic">
        💭 {step.content}
      </div>
    );
  }

  if (step.type === "error") {
    return (
      <div className="agent-step flex items-start gap-2 p-2 bg-red-50 rounded-md">
        <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
        <span className="text-xs text-red-800">{step.content}</span>
      </div>
    );
  }

  return null;
}

function formatArg(v) {
  if (typeof v === "string") {
    if (v.length > 60) return `"${v.slice(0, 57)}..."`;
    return `"${v}"`;
  }
  if (typeof v === "boolean") return v.toString();
  if (typeof v === "number") return v.toString();
  if (v == null) return "null";
  return JSON.stringify(v);
}

function summariseResult(r) {
  if (r.error) return `error: ${r.error}`;
  if (r.matches_found !== undefined) return `Found ${r.matches_found} matching assets`;
  if (r.available !== undefined) {
    return r.available
      ? "Available at requested time"
      : `Conflicts: ${r.conflict_count}`;
  }
  if (r.score !== undefined) {
    return `Score: ${r.score}/100 · ${r.reasoning || r.asset_name || ""}`;
  }
  if (r.status === "swap_request_sent") return "Swap request sent to resident";
  if (r.escalated) return "Escalated to human staff officer";
  if (r.logged) return `Decision logged: ${r.decision || ""}`;
  if (r.success) return "Success";
  return JSON.stringify(r).slice(0, 120);
}
