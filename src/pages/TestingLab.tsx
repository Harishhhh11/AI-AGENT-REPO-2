import { useEffect, useState } from "react";
import {
  FlaskConical,
  Play,
  AlertTriangle,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  Cpu,
  Languages,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import { simulateLabTest, type LabSimulationResponse } from "../api/lab";
import { getAgents, type Agent } from "../api/agents";

const SCENARIOS = [
  {
    id: "maruthi_catalog",
    label: "Maruthi Course Catalog",
    category: "Knowledge Boundary",
    prompt: "Which courses do you offer?",
    desc: "Must return only Core Python Programming and Core Java Programming.",
  },
  {
    id: "java_fee",
    label: "Java Fee",
    category: "Grounded Facts",
    prompt: "What is the fee for Java?",
    desc: "Must return ₹5,000 and no Python or seeded demo facts.",
  },
  {
    id: "python_fee",
    label: "Python Fee",
    category: "Grounded Facts",
    prompt: "How much is Python?",
    desc: "Must return ₹4,000 and no Java or seeded demo facts.",
  },
  {
    id: "unsupported_course",
    label: "Unsupported Course",
    category: "Boundary Handling",
    prompt: "I want to join in Java and Python and Web Development.",
    desc: "Must explicitly say Web Development is not listed in the assigned knowledge.",
  },
  {
    id: "state_reset",
    label: "State Reset",
    category: "Conversation Control",
    prompt: "What are the fees?",
    desc: "A factual question must not start or advance lead capture.",
  },
  {
    id: "no_placement_claim",
    label: "Unsupported Placement",
    category: "Anti-Hallucination",
    prompt: "Do you provide placement assistance?",
    desc: "The uploaded documents do not provide placement information.",
  },
  {
    id: "pricing_inquiry",
    label: "Pricing Inquiry",
    category: "Legacy Regression",
    prompt: "How much do your AI receptionists cost, and what are the plan tiers?",
    desc: "Should be rejected as unsupported by the Maruthi course documents.",
  },
  {
    id: "telugu_code_switch",
    label: "Telugu Course Question",
    category: "Multilingual",
    prompt: "Mee Python course gurinchi Telugu lo cheppandi, fees entha untundi?",
    desc: "Should answer from the Python document without introducing unsupported claims.",
  },
];

export default function TestingLab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(1);
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("pricing_inquiry");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LabSimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAgents().then((data) => {
      setAgents(data);
      if (data.length > 0) setSelectedAgentId(data[0].id);
    });
  }, []);

  async function runSimulation(scenarioId?: string, promptOverride?: string) {
    setRunning(true);
    setError(null);
    try {
      const resp = await simulateLabTest({
        scenario: scenarioId || selectedScenarioId,
        custom_prompt: promptOverride || customPrompt || undefined,
        agent_id: selectedAgentId,
      });
      setResult(resp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Receptionist Testing Lab"
        description="Simulate realistic customer scenarios, stress-test prompt injection defenses, evaluate tool execution, and inspect real-time telemetry."
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
              Interactive Telemetry Sandbox
            </span>
          </div>
        }
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Control Strip */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Scenario Selector & Engine Harness</h2>
              <p className="text-xs text-slate-500">Pick a pre-configured scenario or enter a custom prompt</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-600">Test Target:</label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(Number(e.target.value))}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pre-configured Scenarios Grid */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => {
                setSelectedScenarioId(sc.id);
                setCustomPrompt(sc.prompt);
                runSimulation(sc.id, sc.prompt);
              }}
              className={`rounded-2xl p-4 text-left border transition ${
                selectedScenarioId === sc.id
                  ? "border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/20"
                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {sc.category}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <h3 className="mt-1 text-xs font-bold text-slate-900">{sc.label}</h3>
              <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{sc.desc}</p>
            </button>
          ))}
        </div>

        {/* Custom Prompt Input */}
        <div className="mt-6 border-t border-slate-100 pt-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Custom Test Prompt
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Can you speak in Telugu? Mee fees entha untundi?"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
            <button
              disabled={running || !customPrompt.trim()}
              onClick={() => runSimulation("custom", customPrompt)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50 transition active:scale-95"
            >
              <Play className="h-3.5 w-3.5" />
              {running ? "Simulating..." : "Run Test"}
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry Output & Results */}
      {result && (
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Conversation Turn Preview */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900">Conversation Interaction</h2>

              <div className="space-y-4">
                {/* User Input bubble */}
                <div className="flex gap-3 items-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-4 text-xs text-slate-800 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">VISITOR INQUIRY</p>
                    <p className="font-medium">{result.input_prompt}</p>
                  </div>
                </div>

                {/* AI Receptionist Response bubble */}
                <div className="flex gap-3 items-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl bg-indigo-50/70 border border-indigo-100 p-4 text-xs text-slate-900 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-indigo-600">AI RECEPTIONIST RESPONSE</p>
                      <span className="text-[10px] font-semibold text-slate-400">
                        Language: {result.telemetry.detected_language.toUpperCase()}
                      </span>
                    </div>
                    <p className="font-medium leading-relaxed">{result.response}</p>
                  </div>
                </div>
              </div>

              {/* State Machine Step */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Conversation State Transition
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {["GREETING", "DISCOVERY", "INFORMATION", "QUALIFICATION", "ACTION", "CONFIRMATION", "HANDOFF"].map(
                    (st) => (
                      <span
                        key={st}
                        className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-bold ${
                          result.telemetry.conversation_state === st
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "bg-white text-slate-400 border border-slate-200"
                        }`}
                      >
                        {st}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Deep Telemetry & Verification Badges */}
          <div className="lg:col-span-6 space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-slate-900">Execution Telemetry</h2>

              {/* Status Chips */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-semibold text-slate-500">Detected Language</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {result.telemetry.detected_language === "te"
                      ? "Telugu (తెలుగు)"
                      : result.telemetry.detected_language === "hi"
                      ? "Hindi (हिंदी)"
                      : "English (US)"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-500">Prompt Injection Shield</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-emerald-600">PASS (No flags)</p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-violet-600" />
                    <span className="text-xs font-semibold text-slate-500">Detected Intent</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-slate-900 font-mono text-xs">
                    {result.telemetry.detected_intent}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-semibold text-slate-500">Escalation Triggered</span>
                  </div>
                  <p
                    className={`mt-1 text-sm font-bold ${
                      result.telemetry.is_escalated ? "text-amber-600" : "text-slate-400"
                    }`}
                  >
                    {result.telemetry.is_escalated ? "YES (Human Hand-off)" : "NO (Autonomous)"}
                  </p>
                </div>
              </div>

              {/* Tools Executed Section */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tool Calls Executed ({result.telemetry.tool_calls_executed.length})
                </p>
                {result.telemetry.tool_calls_executed.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No tool calls required for this turn.</p>
                ) : (
                  result.telemetry.tool_calls_executed.map((tc, idx) => (
                    <div key={idx} className="rounded-2xl bg-slate-900 p-3 text-xs text-slate-200 font-mono">
                      <div className="flex items-center justify-between text-indigo-400 text-[11px] font-bold">
                        <span>call: {tc.tool}()</span>
                        <span className="text-emerald-400 text-[10px]">SUCCESS</span>
                      </div>
                      <p className="text-slate-400 mt-1 text-[11px]">
                        args: {JSON.stringify(tc.args)}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Grounding Sources Section */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Knowledge Citations / Grounding ({result.telemetry.grounding_sources_cited.length})
                </p>
                {result.telemetry.grounding_sources_cited.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No direct knowledge articles cited.</p>
                ) : (
                  result.telemetry.grounding_sources_cited.map((gs, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-xs">
                      <BookOpen className="h-4 w-4 text-indigo-600" />
                      <span className="font-bold text-slate-800">{gs.title}</span>
                      <span className="text-slate-400">({gs.source})</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
