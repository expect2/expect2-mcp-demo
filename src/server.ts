import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  verifyChangesInputSchema,
  getStatusInputSchema,
  analyzeFailureInputSchema,
} from "./schemas.js";
import {
  getVerifyChangesResponse,
  getStatusResponse,
  getFailureAnalysisResponse,
  getTestSequence,
  getAnalysisSequence,
  getFailureAnalysisSequence,
  incrementVerifyCallCount,
  getVerifyCallCount,
  type AnalysisStep,
} from "./mock/mock-data.js";
import { log, spinner } from "./logger.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatAnalysisStep(
  phaseName: string,
  step: AnalysisStep
): { message: string; detail?: string } {
  switch (phaseName) {
    case "scanning":
      return {
        message: `${step.file} → ${step.result}`,
      };
    case "dependencies":
      return {
        message: step.message ?? "",
      };
    case "impact":
      const prefix =
        step.type === "modified"
          ? "Modified"
          : step.type === "added"
            ? "Added"
            : "Affected";
      return {
        message: `${prefix}: ${step.target}`,
      };
    case "selection":
      return {
        message: `${step.suite} (${step.count} tests) - ${step.reason}`,
      };
    case "modification":
      return {
        message: `${step.suite}: "${step.test}"`,
        detail: step.modification,
      };
    case "generation":
      return {
        message: `${step.suite}: "${step.test}"`,
        detail: step.reason,
      };
    default:
      return { message: step.message ?? "" };
  }
}

export interface SessionState {
  sessionId: string | null;
}

export function createServer(sessionState: SessionState = { sessionId: null }): McpServer {
  const server = new McpServer({
    name: "expect2",
    version: "0.1.0",
  });

  // Register verify_changes tool
  server.tool(
    "verify_changes",
    "Analyze code changes and run relevant E2E tests. Provide file paths, diffs, and ticket ID - expect2 automatically decides which tests to run, modifies existing tests if needed, and creates new tests for uncovered functionality.",
    {
      projectPath: verifyChangesInputSchema.shape.projectPath,
      changedFiles: verifyChangesInputSchema.shape.changedFiles,
      diffs: verifyChangesInputSchema.shape.diffs,
      ticketId: verifyChangesInputSchema.shape.ticketId,
    },
    async (args, extra) => {
      log.toolCall("verify_changes", args as Record<string, unknown>);
      log.divider();

      // Track verify call count per session to determine first vs subsequent calls
      const currentSessionId = sessionState.sessionId ?? "default";
      const callNumber = incrementVerifyCallCount(currentSessionId);
      const isFirstCall = callNumber === 1;

      log.info(`Session ${currentSessionId}: verify_changes call #${callNumber} (${isFirstCall ? "first" : "subsequent"})`);

      const mockResponse = getVerifyChangesResponse(isFirstCall);
      const testSequence = getTestSequence(isFirstCall);
      const total = testSequence.tests.length;

      // Helper to send MCP progress notifications (does not log - logging is handled separately)
      const sendProgress = async (
        progress: number,
        message: string
      ): Promise<void> => {
        try {
          await extra.sendNotification({
            method: "notifications/progress",
            params: {
              progressToken: extra._meta?.progressToken ?? "default",
              progress,
              total,
              message,
            },
          });
        } catch {
          // Progress notifications are optional - continue if they fail
        }
      };

      // Phase 1: Detailed analysis
      const analysisSequence = getAnalysisSequence(isFirstCall);

      for (const phase of analysisSequence.phases) {
        // Log phase header
        log.analysisPhase(phase.icon, phase.title);

        // Handle the "ready" phase specially
        if (phase.name === "ready") {
          log.analysisComplete(total);
          await sendProgress(0, `${phase.icon} ${phase.title} - ${total} tests ready to run`);
          await sleep(300);
          continue;
        }

        // Process each step in the phase
        for (const step of phase.steps) {
          const { message, detail } = formatAnalysisStep(phase.name, step);

          // Use spinner during analysis
          spinner.start(`${phase.icon} ${message}`);
          await sleep(step.duration);
          spinner.stop();

          // Log the completed step
          log.analysisStep(message, detail);
          await sendProgress(0, `${phase.icon} ${message}`);
        }
      }

      // Phase 2: Run each test
      for (let i = 0; i < testSequence.tests.length; i++) {
        const test = testSequence.tests[i];

        // "Running: test name" - in-place update
        log.progressUpdate(i, total, `Running: ${test.name}`);
        await sendProgress(i, `Running: ${test.name}`);
        await sleep(test.duration);

        // "Passed/FAILED: test name"
        const status = test.result === "passed" ? "Passed" : "FAILED";
        log.progressUpdate(i + 1, total, `${status}: ${test.name}`);
        await sendProgress(i + 1, `${status}: ${test.name}`);

        // Print newline for failures or last test
        if (test.result === "failed" || i === testSequence.tests.length - 1) {
          log.progressNewline();
        }

        await sleep(200); // Brief pause between tests
      }

      log.divider();
      log.toolResult("verify_changes", `${mockResponse.results.passed} passed, ${mockResponse.results.failed} failed`);

      // Return final result
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(mockResponse, null, 2),
          },
        ],
      };
    }
  );

  // Register get_verification_status tool
  server.tool(
    "get_verification_status",
    "Get detailed status of a verification session including progress, test results, and failure reports with console/network logs.",
    {
      sessionId: getStatusInputSchema.shape.sessionId,
    },
    async (args) => {
      log.toolCall("get_verification_status", args as Record<string, unknown>);

      // Use session state to determine which response to return
      const currentSessionId = sessionState.sessionId ?? "default";
      const callCount = getVerifyCallCount(currentSessionId);
      const isFirstCall = callCount <= 1;

      const response = getStatusResponse(isFirstCall);
      const failureCount = response.failures?.length ?? 0;

      // Log each failure with pretty markdown
      if (response.failures && response.failures.length > 0) {
        for (const failure of response.failures) {
          log.failureReport(
            failure.testName,
            failure.suiteName,
            failure.error,
            failure.logs
          );
        }
      }

      log.toolResult(
        "get_verification_status",
        `${response.results.passed}/${response.results.total} passed` +
          (failureCount > 0 ? `, ${failureCount} failure(s) with logs` : "")
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );

  // Register analyze_failure tool
  server.tool(
    "analyze_failure",
    "Get deep analysis of a specific test failure including root cause, suggested fix, and detailed console/network logs.",
    {
      sessionId: analyzeFailureInputSchema.shape.sessionId,
      testName: analyzeFailureInputSchema.shape.testName,
    },
    async (args, extra) => {
      log.toolCall("analyze_failure", args as Record<string, unknown>);

      const sequence = getFailureAnalysisSequence();
      const totalSteps = sequence.phases.reduce((sum, p) => sum + p.steps.length, 0);
      let currentStep = 0;

      // Helper to send progress notifications
      const sendProgress = async (message: string): Promise<void> => {
        try {
          await extra.sendNotification({
            method: "notifications/progress",
            params: {
              progressToken: extra._meta?.progressToken ?? "default",
              progress: currentStep,
              total: totalSteps,
              message,
            },
          });
        } catch {
          // Progress notifications are optional
        }
      };

      // Process each phase
      for (const phase of sequence.phases) {
        log.analysisPhase(phase.icon, phase.title);

        if (phase.name === "complete") {
          log.progressUpdate(totalSteps, totalSteps, "✓ Analysis complete");
          log.progressNewline();
          await sendProgress("✅ Analysis complete");
          break;
        }

        for (const step of phase.steps) {
          spinner.start(`${phase.icon} ${step.message}...`);
          await sleep(step.duration);
          spinner.stop();

          log.analysisStep(step.message, step.result);
          currentStep++;
          await sendProgress(`${phase.icon} ${step.message}`);
        }
      }

      const response = getFailureAnalysisResponse();

      log.divider();
      log.analysisResult({
        testName: response.testName,
        suiteName: response.suiteName,
        failureType: response.failureType,
        rootCause: response.rootCause,
        suggestedFix: response.suggestedFix,
        relatedFiles: response.relatedFiles,
        confidence: response.confidence,
      });
      log.divider();
      log.toolResult(
        "analyze_failure",
        `${response.failureType}: ${response.rootCause.slice(0, 50)}...`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
