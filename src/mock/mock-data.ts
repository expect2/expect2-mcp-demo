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

// Cache for loaded mock data
let verifyResponseCache: VerifyChangesOutput | null = null;
let statusFailedCache: GetStatusOutput | null = null;
let failureAnalysisCache: AnalyzeFailureOutput | null = null;
let testSequenceCache: TestSequence | null = null;
let analysisSequenceCache: AnalysisSequence | null = null;
let failureAnalysisSequenceCache: FailureAnalysisSequence | null = null;

function loadJson<T>(filename: string): T {
  const filepath = join(MOCK_DATA_DIR, filename);
  const content = readFileSync(filepath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Returns the mock response for verify_changes tool
 */
export function getVerifyChangesResponse(): VerifyChangesOutput {
  if (!verifyResponseCache) {
    verifyResponseCache = loadJson<VerifyChangesOutput>("verify-response.json");
  }
  return verifyResponseCache;
}

/**
 * Returns the mock response for get_verification_status tool
 */
export function getStatusResponse(): GetStatusOutput {
  if (!statusFailedCache) {
    statusFailedCache = loadJson<GetStatusOutput>("status-failed.json");
  }
  return statusFailedCache;
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
 */
export function getTestSequence(): TestSequence {
  if (!testSequenceCache) {
    testSequenceCache = loadJson<TestSequence>("test-sequence.json");
  }
  return testSequenceCache;
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
