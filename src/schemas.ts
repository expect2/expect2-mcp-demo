import { z } from "zod";

// ============================================
// verify_changes tool schemas
// ============================================

export const verifyChangesInputSchema = z.object({
  projectPath: z.string().describe("Path to the project"),
  changedFiles: z.array(z.string()).describe("List of changed file paths"),
  diffs: z.string().optional().describe("Git diff output of the changes"),
  ticketId: z.string().optional().describe("Associated ticket/issue ID for context"),
});

export const verifyChangesOutputSchema = z.object({
  sessionId: z.string(),
  status: z.enum(["analyzing", "running", "passed", "failed", "error"]),
  changesAnalyzed: z.object({
    filesChanged: z.number(),
    affectedComponents: z.array(z.string()),
  }),
  testsSelected: z.array(
    z.object({
      suiteName: z.string(),
      testCount: z.number(),
      reason: z.string(),
    })
  ),
  testsModified: z.array(
    z.object({
      suiteName: z.string(),
      testName: z.string(),
      modification: z.string(),
    })
  ),
  testsAdded: z.array(
    z.object({
      suiteName: z.string(),
      testName: z.string(),
      reason: z.string(),
    })
  ),
  results: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
  }),
  summary: z.string(),
});

// ============================================
// get_verification_status tool schemas
// ============================================

export const getStatusInputSchema = z.object({
  sessionId: z.string().describe("Verification session ID"),
});

export const getStatusOutputSchema = z.object({
  sessionId: z.string(),
  status: z.enum(["pending", "analyzing", "running", "passed", "failed", "error"]),
  progress: z.object({
    testsRun: z.number(),
    testsTotal: z.number(),
    currentTest: z.string().nullable(),
  }),
  results: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    duration: z.number(),
  }),
  failures: z.array(
    z.object({
      testName: z.string(),
      suiteName: z.string(),
      error: z.string(),
      logs: z.string(),
    })
  ),
});

// ============================================
// analyze_failure tool schemas
// ============================================

export const analyzeFailureInputSchema = z.object({
  sessionId: z.string().describe("Verification session ID"),
  testName: z.string().describe("Name of the failed test to analyze"),
});

export const analyzeFailureOutputSchema = z.object({
  testName: z.string(),
  suiteName: z.string(),
  failureType: z.enum([
    "assertion",
    "timeout",
    "element_not_found",
    "network",
    "script_error",
    "state_corruption",
  ]),
  rootCause: z.string(),
  suggestedFix: z.string(),
  relatedFiles: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  logs: z.string(),
});

// ============================================
// Type exports
// ============================================

export type VerifyChangesInput = z.infer<typeof verifyChangesInputSchema>;
export type VerifyChangesOutput = z.infer<typeof verifyChangesOutputSchema>;
export type GetStatusInput = z.infer<typeof getStatusInputSchema>;
export type GetStatusOutput = z.infer<typeof getStatusOutputSchema>;
export type AnalyzeFailureInput = z.infer<typeof analyzeFailureInputSchema>;
export type AnalyzeFailureOutput = z.infer<typeof analyzeFailureOutputSchema>;
