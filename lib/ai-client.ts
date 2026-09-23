import { analysisSchema, type Analysis } from "./analysis-schema";
import type { Decision } from "./types";
export type AiState = {
  status: "idle" | "loading" | "success" | "error" | "disabled";
  scenarioId?: string;
  analysis?: Analysis;
};
// One active request per mounted simulator. A revision also protects against transports
// that finish after abort. No network call is tied to React render/effect execution.
export class AnalysisRequest {
  private revision = 0;
  private controller: AbortController | null = null;
  private state: AiState = { status: "idle" };
  constructor(
    private publish: (state: AiState) => void,
    private transport: typeof fetch = (...args) => fetch(...args),
  ) {}
  private update(state: AiState) {
    this.state = state;
    this.publish(state);
  }
  invalidate() {
    this.revision++;
    this.controller?.abort();
    this.controller = null;
    this.update({ status: "idle" });
  }
  dispose() {
    this.revision++;
    this.controller?.abort();
  }
  async run(decisions: Decision[], scenarioId: string, retry = false) {
    if (
      this.state.scenarioId === scenarioId &&
      (this.state.status === "loading" || !retry)
    )
      return;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const revision = ++this.revision;
    this.update({ status: "loading", scenarioId });
    try {
      const response = await this.transport("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (revision !== this.revision || controller.signal.aborted) return;
      if (!response.ok) {
        this.update({
          status:
            data?.code === "AI_DISABLED" || data?.code === "AI_NOT_CONFIGURED"
              ? "disabled"
              : "error",
          scenarioId,
        });
        return;
      }
      if (
        data?.scenarioId !== scenarioId ||
        !analysisSchema.safeParse(data.analysis).success
      )
        throw new Error("Invalid analysis");
      this.update({
        status: "success",
        scenarioId,
        analysis: analysisSchema.parse(data.analysis),
      });
    } catch {
      if (revision === this.revision && !controller.signal.aborted)
        this.update({ status: "error", scenarioId });
    }
  }
}
