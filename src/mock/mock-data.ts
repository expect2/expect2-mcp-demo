import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  VerifyChangesOutput,
  GetStatusOutput,
  AnalyzeFailureOutput,
} from "../schemas.js";

// Get the directory of this module
const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_DATA_DIR = join(__dirname, "../../mock-data");

// Test sequence type
export interface TestItem {
  name: string;
  suite: string;
  result: "passed" | "failed";
  duration: number;
}

export interface TestSequence {
  tests: TestItem[];
}

// Analysis sequence types
export interface AnalysisStep {
  // File scanning
  file?: string;
  result?: string;
  // Dependency/impact
  message?: string;
  type?: "modified" | "added" | "affected";
  target?: string;
  // Test selection
  suite?: string;
  count?: number;
  reason?: string;
  // Test modification/generation
  test?: string;
  modification?: string;
  // Common
  duration: number;
}

export interface AnalysisPhase {
  name: string;
  icon: string;
  title: string;
  steps: AnalysisStep[];
}

export interface AnalysisSequence {
  phases: AnalysisPhase[];
}

// Failure analysis sequence types
export interface FailureAnalysisStep {
  message: string;
  result: string;
  duration: number;
}

export interface FailureAnalysisPhase {
  name: string;
  icon: string;
  title: string;
  steps: FailureAnalysisStep[];
}

export interface FailureAnalysisSequence {
  phases: FailureAnalysisPhase[];
}

// Session state tracking for first-call vs subsequent-call behavior
const sessionVerifyCallCounts = new Map<string, number>();

/**
 * Increment and return the verify call count for a session
 */
export function incrementVerifyCallCount(sessionId: string): number {
  const current = sessionVerifyCallCounts.get(sessionId) ?? 0;
  const newCount = current + 1;
  sessionVerifyCallCounts.set(sessionId, newCount);
  return newCount;
}

/**
 * Get the current verify call count for a session (without incrementing)
 */
export function getVerifyCallCount(sessionId: string): number {
  return sessionVerifyCallCounts.get(sessionId) ?? 0;
}

/**
 * Clear session state (call when session closes)
 */
export function clearSessionState(sessionId: string): void {
  sessionVerifyCallCounts.delete(sessionId);
}

// Cache for loaded mock data (failed scenario - first call)
let verifyResponseFailedCache: VerifyChangesOutput | null = null;
let statusFailedCache: GetStatusOutput | null = null;
let failureAnalysisCache: AnalyzeFailureOutput | null = null;
let testSequenceFailedCache: TestSequence | null = null;
let analysisSequenceCache: AnalysisSequence | null = null;
let failureAnalysisSequenceCache: FailureAnalysisSequence | null = null;

// Cache for loaded mock data (passed scenario - subsequent calls)
let verifyResponsePassedCache: VerifyChangesOutput | null = null;
let statusPassedCache: GetStatusOutput | null = null;
let testSequencePassedCache: TestSequence | null = null;

function loadJson<T>(filename: string): T {
  const filepath = join(MOCK_DATA_DIR, filename);
  const content = readFileSync(filepath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Returns the mock response for verify_changes tool
 * @param isFirstCall - If true, returns failed response; if false, returns passed response
 */
export function getVerifyChangesResponse(isFirstCall: boolean = true): VerifyChangesOutput {
  if (isFirstCall) {
    if (!verifyResponseFailedCache) {
      verifyResponseFailedCache = loadJson<VerifyChangesOutput>("verify-response.json");
    }
    return verifyResponseFailedCache;
  } else {
    if (!verifyResponsePassedCache) {
      verifyResponsePassedCache = loadJson<VerifyChangesOutput>("verify-response-passed.json");
    }
    return verifyResponsePassedCache;
  }
}

/**
 * Returns the mock response for get_verification_status tool
 * @param isFirstCall - If true, returns failed response; if false, returns passed response
 */
export function getStatusResponse(isFirstCall: boolean = true): GetStatusOutput {
  if (isFirstCall) {
    if (!statusFailedCache) {
      statusFailedCache = loadJson<GetStatusOutput>("status-failed.json");
    }
    return statusFailedCache;
  } else {
    if (!statusPassedCache) {
      statusPassedCache = loadJson<GetStatusOutput>("status-passed.json");
    }
    return statusPassedCache;
  }
}

/**
 * Returns the mock response for analyze_failure tool
 */
export function getFailureAnalysisResponse(): AnalyzeFailureOutput {
  if (!failureAnalysisCache) {
    failureAnalysisCache = loadJson<AnalyzeFailureOutput>("failure-analysis.json");
  }
  return failureAnalysisCache;
}

/**
 * Returns the test sequence for streaming progress
 * @param isFirstCall - If true, returns failed sequence; if false, returns passed sequence
 */
export function getTestSequence(isFirstCall: boolean = true): TestSequence {
  if (isFirstCall) {
    if (!testSequenceFailedCache) {
      testSequenceFailedCache = loadJson<TestSequence>("test-sequence.json");
    }
    return testSequenceFailedCache;
  } else {
    if (!testSequencePassedCache) {
      testSequencePassedCache = loadJson<TestSequence>("test-sequence-passed.json");
    }
    return testSequencePassedCache;
  }
}

/**
 * Returns the analysis sequence for detailed progress
 */
export function getAnalysisSequence(): AnalysisSequence {
  if (!analysisSequenceCache) {
    analysisSequenceCache = loadJson<AnalysisSequence>("analysis-sequence.json");
  }
  return analysisSequenceCache;
}

/**
 * Returns the failure analysis sequence for analyze_failure tool progress
 */
export function getFailureAnalysisSequence(): FailureAnalysisSequence {
  if (!failureAnalysisSequenceCache) {
    failureAnalysisSequenceCache = loadJson<FailureAnalysisSequence>("analysis-failure-sequence.json");
  }
  return failureAnalysisSequenceCache;
}
