import { post } from "./client";

export interface LabSimulationResponse {
  scenario: string;
  input_prompt: string;
  response: string;
  telemetry: {
    detected_intent: string;
    detected_language: "en" | "te" | "hi";
    conversation_state: string;
    is_escalated: boolean;
    tool_calls_executed: { tool: string; args: Record<string, unknown>; result: unknown }[];
    grounding_sources_cited: { id: number; title: string; source: string }[];
    prompt_injection_flagged: boolean;
  };
}

export async function simulateLabTest(params: {
  scenario?: string;
  custom_prompt?: string;
  agent_id?: number;
}): Promise<LabSimulationResponse> {
  return post<LabSimulationResponse, typeof params>("/lab/simulate", params);
}
