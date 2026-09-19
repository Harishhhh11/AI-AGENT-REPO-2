import { useEffect, useRef, useState, useCallback } from "react";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  CheckCircle2,
  Sliders,
  Radio,
  User,
  Bot,
} from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import {
  getVoiceCalls,
  getTelephonyConfig,
  updateTelephonyConfig,
  simulateVoiceCall,
  type VoiceCall,
  type TelephonyConfig,
} from "../api/voice";
import { getAgents, type Agent } from "../api/agents";

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

export default function Voice() {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [config, setConfig] = useState<TelephonyConfig | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Active call simulator state
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(1);
  const [callerNumber, setCallerNumber] = useState("+1 (555) 301-4499");
  const [callTranscript, setCallTranscript] = useState<{ role: string; text: string; time: string }[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [customInputText, setCustomInputText] = useState("");
  const [isSimulatingTurn, setIsSimulatingTurn] = useState(false);
  const [selectedCallDetails, setSelectedCallDetails] = useState<VoiceCall | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);

  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getVoiceCalls(), getTelephonyConfig(), getAgents()])
      .then(([callsData, configData, agentsData]) => {
        if (!mounted) return;
        setCalls(callsData);
        setConfig(configData);
        setAgents(agentsData);
        if (agentsData.length > 0) setSelectedAgentId(agentsData[0].id);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load voice telephony data.");
      });

    return () => {
      mounted = false;
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  // Timer loop when call is active
  useEffect(() => {
    if (isCallActive) {
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [isCallActive]);

  const speakText = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Female") || v.name.includes("Natural") || v.name.includes("Google")),
    );
    if (englishVoice) utterance.voice = englishVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const sendVoiceInput = useCallback(
    async (input: string) => {
      if (!input.trim() || isSimulatingTurn) return;
      setIsSimulatingTurn(true);

      const nowMin = Math.floor(callDuration / 60)
        .toString()
        .padStart(2, "0");
      const nowSec = (callDuration % 60).toString().padStart(2, "0");
      const timestamp = `${nowMin}:${nowSec}`;

      setCallTranscript((prev) => [
        ...prev,
        { role: "caller", text: input, time: timestamp },
      ]);
      setCustomInputText("");

      try {
        const response = await simulateVoiceCall({
          spoken_input: input,
          caller_number: callerNumber,
          agent_id: selectedAgentId,
        });

        setCallTranscript((prev) => [
          ...prev,
          { role: "assistant", text: response.voice_reply, time: timestamp },
        ]);

        speakText(response.voice_reply);
        getVoiceCalls().then(setCalls);
      } catch (err) {
        console.error("Voice turn error:", err);
      } finally {
        setIsSimulatingTurn(false);
      }
    },
    [callDuration, callerNumber, isSimulatingTurn, selectedAgentId, speakText],
  );

  // Speech Recognition setup
  useEffect(() => {
    const win = window as WindowWithSpeech;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setSpokenText(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => {
        setIsListening(false);
        if (spokenText.trim()) {
          sendVoiceInput(spokenText.trim());
          setSpokenText("");
        }
      };
      speechRecognitionRef.current = recognition;
    }
  }, [spokenText, sendVoiceInput]);

  function startCall() {
    setIsCallActive(true);
    setCallDuration(0);
    const agent = agents.find((a) => a.id === selectedAgentId) || agents[0];
    const initialGreeting =
      agent?.welcome_message ||
      "Hello, welcome to Apex Solutions. I'm your digital receptionist. How may I direct your call?";

    setCallTranscript([
      {
        role: "assistant",
        text: initialGreeting,
        time: "00:00",
      },
    ]);

    speakText(initialGreeting);
  }

  function endCall() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (speechRecognitionRef.current && isListening) speechRecognitionRef.current.stop();
    setIsCallActive(false);
    setIsSpeaking(false);
    setIsListening(false);
    setSpokenText("");
  }

  function toggleMicListening() {
    if (isListening) {
      if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
    } else {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpokenText("");
      try {
        speechRecognitionRef.current?.start();
      } catch {
        // Recognition already running or unsupported
      }
    }
  }

  function bargeInInterruption() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    toggleMicListening();
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    try {
      const updated = await updateTelephonyConfig(config);
      setConfig(updated);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update configuration.");
    }
  }

  function formatTime(totalSeconds: number) {
    const mins = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Voice AI & Telephony"
        description="Low-latency voice receptionist engine with Speech-to-Text, instant barge-in interruption, SIP telephony integration, and live call logs."
        actions={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-600" />
              SIP Gateway Online
            </span>
          </div>
        }
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main Grid: Interactive Simulator & Live Call Logs */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Interactive Call Simulator */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Interactive Call Studio</h2>
                  <p className="text-xs text-slate-500">
                    Test voice speech synthesis, live microphone input & interruption
                  </p>
                </div>
              </div>

              {isCallActive ? (
                <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Live {formatTime(callDuration)}
                </div>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Idle
                </span>
              )}
            </div>

            {/* Receptionist Selector & Caller Info */}
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  AI Receptionist
                </label>
                <select
                  disabled={isCallActive}
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.voice_id || "maya_warm"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Caller Phone Number
                </label>
                <input
                  type="text"
                  disabled={isCallActive}
                  value={callerNumber}
                  onChange={(e) => setCallerNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Live Audio Visualizer Stage */}
            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-950 p-6 text-center text-white relative overflow-hidden">
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 ${
                    isSpeaking
                      ? "bg-indigo-600 shadow-2xl shadow-indigo-500/50 ring-8 ring-indigo-500/20 scale-105"
                      : isListening
                      ? "bg-emerald-600 shadow-2xl shadow-emerald-500/50 ring-8 ring-emerald-500/20 scale-105"
                      : isCallActive
                      ? "bg-slate-800 ring-4 ring-slate-700"
                      : "bg-slate-800"
                  }`}
                >
                  {isSpeaking ? (
                    <Volume2 className="h-10 w-10 animate-bounce text-white" />
                  ) : isListening ? (
                    <Mic className="h-10 w-10 animate-pulse text-white" />
                  ) : isCallActive ? (
                    <Phone className="h-9 w-9 text-emerald-400" />
                  ) : (
                    <PhoneOff className="h-9 w-9 text-slate-500" />
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold">
                    {isSpeaking
                      ? "Receptionist is speaking..."
                      : isListening
                      ? "Listening to your voice..."
                      : isCallActive
                      ? "Call Connected — Waiting for input"
                      : "Ready to simulate inbound phone call"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {isCallActive
                      ? "Speak via microphone or use quick speech simulator buttons below"
                      : "Click 'Start Inbound Call' to launch live audio session"}
                  </p>
                </div>

                {/* Simulated Audio Waveform */}
                <div className="mt-5 flex items-center justify-center gap-1.5 h-6">
                  {[40, 65, 30, 90, 45, 80, 55, 95, 35, 70, 50, 85].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        height:
                          isSpeaking || isListening
                            ? `${Math.max(15, h * (isSpeaking ? 1 : 0.7))}%`
                            : "4px",
                        transition: "height 0.15s ease",
                      }}
                      className={`w-1 rounded-full ${
                        isSpeaking
                          ? "bg-indigo-400"
                          : isListening
                          ? "bg-emerald-400"
                          : "bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Call Control Buttons */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {!isCallActive ? (
                  <button
                    onClick={startCall}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition active:scale-95"
                  >
                    <Phone className="h-4 w-4" />
                    Start Inbound Call
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleMicListening}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                        isListening
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                          : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      }`}
                    >
                      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {isListening ? "Stop Microphone" : "Speak Now (Mic)"}
                    </button>

                    <button
                      onClick={bargeInInterruption}
                      title="Simulates interrupting the AI receptionist while speaking"
                      className="flex items-center gap-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 px-4 py-2.5 text-xs font-bold hover:bg-amber-500/30 transition"
                    >
                      <VolumeX className="h-4 w-4" />
                      Barge-In (Interrupt AI)
                    </button>

                    <button
                      onClick={endCall}
                      className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition active:scale-95"
                    >
                      <PhoneOff className="h-4 w-4" />
                      Hang Up
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Test Voice Utterances */}
            {isCallActive && (
              <div className="mt-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quick Voice Utterances (Test common caller intents)
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "What are your business hours?",
                    "How much do your AI receptionists cost?",
                    "I want to book an enterprise consultation.",
                    "Can you speak in Telugu? Mee fees entha?",
                    "I'd like to speak with a human manager.",
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      disabled={isSimulatingTurn}
                      onClick={() => sendVoiceInput(preset)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700 transition disabled:opacity-50"
                    >
                      "{preset}"
                    </button>
                  ))}
                </div>

                {/* Custom Voice Text Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customInputText.trim()) sendVoiceInput(customInputText.trim());
                  }}
                  className="mt-3 flex gap-2"
                >
                  <input
                    type="text"
                    disabled={isSimulatingTurn}
                    placeholder="Type caller statement..."
                    value={customInputText}
                    onChange={(e) => setCustomInputText(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSimulatingTurn || !customInputText.trim()}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}

            {/* Real-time Call Transcript Feed */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Live Call Transcript ({callTranscript.length} turns)
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                {callTranscript.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Transcript will appear here once the call is connected.
                  </p>
                ) : (
                  callTranscript.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 text-xs ${
                        entry.role === "assistant" ? "items-start" : "items-start flex-row-reverse"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          entry.role === "assistant"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        {entry.role === "assistant" ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        className={`max-w-[80%] rounded-2xl p-3 ${
                          entry.role === "assistant"
                            ? "bg-white border border-slate-200 text-slate-800"
                            : "bg-indigo-600 text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-75">
                          <span className="font-semibold">
                            {entry.role === "assistant" ? "AI Receptionist" : "Caller"}
                          </span>
                          <span>{entry.time}</span>
                        </div>
                        <p className="leading-relaxed">{entry.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Telephony Config & Call Details */}
        <div className="lg:col-span-5 space-y-6">
          {/* Telephony Gateway Settings */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <Sliders className="h-5 w-5 text-indigo-600" />
                <h2 className="text-base font-bold text-slate-900">Telephony Configuration</h2>
              </div>
              {configSuccess && (
                <span className="text-xs font-semibold text-emerald-600">Saved!</span>
              )}
            </div>

            {config && (
              <form onSubmit={handleSaveConfig} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Telephony Provider
                  </label>
                  <select
                    value={config.provider}
                    onChange={(e) => setConfig({ ...config, provider: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Twilio">Twilio Voice Gateway</option>
                    <option value="Exotel">Exotel Voice Cloud</option>
                    <option value="Plivo">Plivo SIP Trunk</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Assigned Virtual Phone Number
                  </label>
                  <input
                    type="text"
                    value={config.virtual_phone_number}
                    onChange={(e) => setConfig({ ...config, virtual_phone_number: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Voice Synthesis Model
                  </label>
                  <input
                    type="text"
                    value={config.voice_engine}
                    onChange={(e) => setConfig({ ...config, voice_engine: e.target.value })}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">User Barge-In</p>
                    <p className="text-[11px] text-slate-500">
                      Stop speaking immediately when caller speaks
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.barge_in_enabled}
                    onChange={(e) => setConfig({ ...config, barge_in_enabled: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Record Call Transcripts</p>
                    <p className="text-[11px] text-slate-500">Persist full audio recordings for QA</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.record_calls}
                    onChange={(e) => setConfig({ ...config, record_calls: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                >
                  Save Telephony Settings
                </button>
              </form>
            )}
          </div>

          {/* Quick Telephony Metric Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Total Calls Logged</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{calls.length}</p>
              <p className="mt-1 text-[11px] text-emerald-600 font-medium">99.8% uptime</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Avg Call Duration</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">2m 15s</p>
              <p className="mt-1 text-[11px] text-indigo-600 font-medium">Ultra-low latency</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Call Logs & History */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Telephony Call Logs</h2>
            <p className="text-xs text-slate-500">
              Audit trail of all inbound and outbound voice receptionist sessions
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Call SID</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Caller Number</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">
                    {call.call_sid}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      <PhoneIncoming className="h-3 w-3" />
                      {call.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-slate-900">
                    {call.caller_number}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    {call.duration_seconds}s
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {call.outcome.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {call.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedCallDetails(call)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      View Transcript
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Call Details Drawer/Modal */}
      {selectedCallDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Call Transcript: {selectedCallDetails.call_sid}
                </h3>
                <p className="text-xs text-slate-500">
                  Caller: {selectedCallDetails.caller_number} • Duration:{" "}
                  {selectedCallDetails.duration_seconds}s
                </p>
              </div>
              <button
                onClick={() => setSelectedCallDetails(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              {selectedCallDetails.transcript?.map((t, idx) => (
                <div key={idx} className="text-xs space-y-0.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span className={t.role === "assistant" ? "text-indigo-600" : "text-slate-700"}>
                      {t.role === "assistant" ? "Maya (AI Receptionist)" : "Caller"}
                    </span>
                    <span>{t.timestamp}</span>
                  </div>
                  <p className="text-slate-800 rounded-lg bg-white p-2.5 border border-slate-100">
                    {t.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedCallDetails(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
