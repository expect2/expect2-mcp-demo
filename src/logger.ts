// HTTP mode flag - enables animations (disabled for stdio mode)
let httpMode = false;

export function setHttpMode(enabled: boolean): void {
  httpMode = enabled;
}

// Log output function - uses stdout in HTTP mode, stderr in stdio mode
// This prevents log output from interfering with JSON-RPC protocol on stdout
function logOutput(message: string): void {
  if (httpMode) {
    console.log(message);
  } else {
    console.error(message);
  }
}

// Spinner frames for animation
const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Spinner class for animated progress (HTTP mode only)
class Spinner {
  private interval: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private message = "";

  start(message: string): void {
    if (!httpMode) return;
    this.message = message;
    this.frameIndex = 0;
    this.render();
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % spinnerFrames.length;
      this.render();
    }, 80);
  }

  update(message: string): void {
    this.message = message;
    if (!this.interval) this.render();
  }

  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (httpMode) {
      this.clearLine();
      if (finalMessage) {
        logOutput(finalMessage);
      }
    }
  }

  private render(): void {
    if (!httpMode) return;
    const frame = spinnerFrames[this.frameIndex];
    this.clearLine();
    process.stdout.write(`${colors.cyan}${frame}${colors.reset} ${this.message}`);
  }

  private clearLine(): void {
    process.stdout.write("\r\x1b[K");
  }
}

export const spinner = new Spinner();

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Background
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

function timestamp(): string {
  return new Date().toISOString().split("T")[1].slice(0, 12);
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "{}";

  return entries
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.slice(0, 3).join(", ")}${value.length > 3 ? "..." : ""}]`;
      }
      if (typeof value === "string" && value.length > 50) {
        return `${key}: "${value.slice(0, 50)}..."`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join(", ");
}

export const log = {
  // Tool call started
  toolCall(toolName: string, args: Record<string, unknown>): void {
    logOutput(
      `${colors.gray}${timestamp()}${colors.reset} ` +
      `${colors.bgBlue}${colors.white}${colors.bold} TOOL ${colors.reset} ` +
      `${colors.cyan}${toolName}${colors.reset} ` +
      `${colors.dim}${formatArgs(args)}${colors.reset}`
    );
  },

  // Tool call completed
  toolResult(toolName: string, summary: string): void {
    logOutput(
      `${colors.gray}${timestamp()}${colors.reset} ` +
      `${colors.bgGreen}${colors.black}${colors.bold} DONE ${colors.reset} ` +
      `${colors.cyan}${toolName}${colors.reset} ` +
      `${colors.dim}${summary}${colors.reset}`
    );
  },

  // Progress notification (prints new line each time - for stdio mode)
  progress(current: number, total: number, message: string): void {
    const percent = Math.round((current / total) * 100);
    const bar = "█".repeat(Math.floor(percent / 5)) + "░".repeat(20 - Math.floor(percent / 5));

    // Color based on message content
    let icon = "⏳";
    let msgColor = colors.white;
    if (message.startsWith("Passed:")) {
      icon = "✓";
      msgColor = colors.green;
    } else if (message.startsWith("FAILED:")) {
      icon = "✗";
      msgColor = colors.red;
    } else if (message.startsWith("Running:")) {
      icon = "▶";
      msgColor = colors.yellow;
    } else if (message.startsWith("Analyzing")) {
      icon = "🔍";
      msgColor = colors.blue;
    } else if (message.startsWith("Identified") || message.startsWith("Selected")) {
      icon = "📋";
      msgColor = colors.magenta;
    }

    logOutput(
      `${colors.gray}${timestamp()}${colors.reset} ` +
      `${colors.dim}[${bar}]${colors.reset} ` +
      `${colors.bold}${percent.toString().padStart(3)}%${colors.reset} ` +
      `${icon} ${msgColor}${message}${colors.reset}`
    );
  },

  // In-place progress update (HTTP mode only - overwrites current line)
  progressUpdate(current: number, total: number, message: string): void {
    if (!httpMode) {
      // Fall back to line-by-line in stdio mode
      this.progress(current, total, message);
      return;
    }

    const percent = Math.round((current / total) * 100);
    const filled = Math.floor(percent / 5);
    const bar = "█".repeat(filled) + "░".repeat(20 - filled);

    let icon = "▶";
    let msgColor = colors.yellow;
    if (message.startsWith("Passed:")) {
      icon = "✓";
      msgColor = colors.green;
    } else if (message.startsWith("FAILED:")) {
      icon = "✗";
      msgColor = colors.red;
    }

    // Clear line and write progress in-place
    process.stdout.write(
      `\r\x1b[K${colors.dim}[${bar}]${colors.reset} ` +
      `${colors.bold}${percent.toString().padStart(3)}%${colors.reset} ` +
      `${icon} ${msgColor}${message}${colors.reset}`
    );
  },

  // Move to next line (call after in-place updates when transitioning)
  progressNewline(): void {
    if (httpMode) {
      process.stdout.write("\n");
    }
  },

  // Info message
  info(message: string): void {
    logOutput(
      `${colors.gray}${timestamp()}${colors.reset} ` +
      `${colors.blue}ℹ${colors.reset} ${message}`
    );
  },

  // Error message
  error(message: string, error?: unknown): void {
    logOutput(
      `${colors.gray}${timestamp()}${colors.reset} ` +
      `${colors.red}✗ ERROR:${colors.reset} ${message}`
    );
    if (error) {
      logOutput(`${colors.dim}${error}${colors.reset}`);
    }
  },

  // Session events
  session(action: "new" | "closed", sessionId: string): void {
    const icon = action === "new" ? "🔗" : "🔌";
    const actionText = action === "new" ? "New session" : "Session closed";
    logOutput(
      `${colors.gray}${timestamp()}${colors.reset} ` +
      `${icon} ${colors.magenta}${actionText}:${colors.reset} ${sessionId}`
    );
  },

  // Server startup
  startup(port: number): void {
    const portStr = String(port);
    // Box is 39 chars wide inside. "   ▶ Running on port " = 21 chars
    const portPadding = " ".repeat(18 - portStr.length);

    logOutput("");
    logOutput(`${colors.bold}${colors.cyan}╔═══════════════════════════════════════╗${colors.reset}`);
    logOutput(`${colors.bold}${colors.cyan}║${colors.reset}   ${colors.bold}expect2${colors.reset} MCP Server                  ${colors.bold}${colors.cyan}║${colors.reset}`);
    logOutput(`${colors.bold}${colors.cyan}╠═══════════════════════════════════════╣${colors.reset}`);
    logOutput(`${colors.bold}${colors.cyan}║${colors.reset}   ${colors.green}▶${colors.reset} Running on port ${colors.yellow}${portStr}${colors.reset}${portPadding}${colors.bold}${colors.cyan}║${colors.reset}`);
    logOutput(`${colors.bold}${colors.cyan}║${colors.reset}   ${colors.dim}Press Ctrl+C to stop${colors.reset}                ${colors.bold}${colors.cyan}║${colors.reset}`);
    logOutput(`${colors.bold}${colors.cyan}╚═══════════════════════════════════════╝${colors.reset}`);
    logOutput("");
  },

  // Divider for visual separation
  divider(): void {
    logOutput(`${colors.dim}${"─".repeat(50)}${colors.reset}`);
  },

  // Analysis phase header
  analysisPhase(icon: string, title: string): void {
    logOutput("");
    logOutput(`${icon} ${colors.bold}${colors.cyan}${title}${colors.reset}`);
  },

  // Analysis step (indented)
  analysisStep(message: string, detail?: string): void {
    const ts = `${colors.gray}${timestamp()}${colors.reset}`;
    logOutput(`${ts}   └─ ${message}`);
    if (detail) {
      logOutput(`${colors.dim}              └─ ${detail}${colors.reset}`);
    }
  },

  // Analysis complete message
  analysisComplete(testCount: number): void {
    logOutput("");
    logOutput(
      `${colors.green}✅${colors.reset} ${colors.bold}Analysis complete${colors.reset} - ` +
      `${colors.yellow}${testCount} tests${colors.reset} ready to run`
    );
    logOutput("");
  },

  // Pretty print markdown content
  markdown(content: string): void {
    const lines = content.split("\n");

    for (const line of lines) {
      // Headers
      if (line.startsWith("# ")) {
        logOutput(`\n${colors.bold}${colors.cyan}${line.slice(2)}${colors.reset}`);
        logOutput(`${colors.cyan}${"═".repeat(line.length - 2)}${colors.reset}`);
      } else if (line.startsWith("## ")) {
        logOutput(`\n${colors.bold}${colors.yellow}${line.slice(3)}${colors.reset}`);
        logOutput(`${colors.yellow}${"─".repeat(line.length - 3)}${colors.reset}`);
      } else if (line.startsWith("### ")) {
        logOutput(`\n${colors.bold}${colors.magenta}${line.slice(4)}${colors.reset}`);
      }
      // Bold text
      else if (line.startsWith("**") && line.includes(":**")) {
        const match = line.match(/\*\*(.+?):\*\*\s*(.*)/);
        if (match) {
          logOutput(`${colors.bold}${match[1]}:${colors.reset} ${match[2]}`);
        } else {
          logOutput(line.replace(/\*\*(.+?)\*\*/g, `${colors.bold}$1${colors.reset}`));
        }
      }
      // Table header
      else if (line.startsWith("| ") && line.includes(" | ")) {
        const cells = line.split("|").filter(c => c.trim());
        const formatted = cells.map(c => `${colors.bold}${c.trim().padEnd(15)}${colors.reset}`).join(" ");
        logOutput(`  ${formatted}`);
      }
      // Table separator
      else if (line.startsWith("|--") || line.startsWith("| --")) {
        // Skip separator lines
      }
      // Code blocks
      else if (line.startsWith("```")) {
        if (line.length > 3) {
          logOutput(`${colors.dim}─── ${line.slice(3)} ───${colors.reset}`);
        } else {
          logOutput(`${colors.dim}${"─".repeat(30)}${colors.reset}`);
        }
      }
      // Regular lines in code block context or error messages
      else if (line.includes("Error") || line.includes("at ")) {
        logOutput(`${colors.red}  ${line}${colors.reset}`);
      }
      // Empty lines
      else if (line.trim() === "") {
        // Skip empty lines
      }
      // Regular content
      else {
        logOutput(`  ${line}`);
      }
    }
    logOutput("");
  },

  // Failure report with markdown logs
  failureReport(testName: string, suiteName: string, error: string, logs: string): void {
    logOutput("");
    logOutput(`${colors.bgRed}${colors.white}${colors.bold} FAILURE REPORT ${colors.reset}`);
    logOutput(`${colors.bold}Test:${colors.reset}  ${testName}`);
    logOutput(`${colors.bold}Suite:${colors.reset} ${suiteName}`);
    logOutput(`${colors.bold}Error:${colors.reset} ${colors.red}${error}${colors.reset}`);
    logOutput("");
    log.markdown(logs);
  },

  // Analysis result summary
  analysisResult(result: {
    testName: string;
    suiteName: string;
    failureType: string;
    rootCause: string;
    suggestedFix: string;
    relatedFiles: string[];
    confidence: string;
  }): void {
    logOutput("");
    logOutput(`${colors.bgBlue}${colors.white}${colors.bold} ANALYSIS RESULT ${colors.reset}`);
    logOutput("");

    // Test info
    logOutput(`${colors.bold}${colors.cyan}Test:${colors.reset} ${result.testName}`);
    logOutput(`${colors.bold}${colors.cyan}Suite:${colors.reset} ${result.suiteName}`);
    logOutput("");

    // Failure type and confidence
    const confidenceColor = result.confidence === "high" ? colors.green :
                           result.confidence === "medium" ? colors.yellow : colors.red;
    logOutput(`${colors.bold}Type:${colors.reset} ${colors.yellow}${result.failureType}${colors.reset}`);
    logOutput(`${colors.bold}Confidence:${colors.reset} ${confidenceColor}${result.confidence.toUpperCase()}${colors.reset}`);
    logOutput("");

    // Root cause (wrapped)
    logOutput(`${colors.bold}${colors.red}Root Cause:${colors.reset}`);
    const words = result.rootCause.split(" ");
    let line = "  ";
    for (const word of words) {
      if (line.length + word.length > 70) {
        logOutput(line);
        line = "  " + word + " ";
      } else {
        line += word + " ";
      }
    }
    if (line.trim()) logOutput(line);
    logOutput("");

    // Related files
    logOutput(`${colors.bold}Related Files:${colors.reset}`);
    for (const file of result.relatedFiles) {
      logOutput(`  ${colors.cyan}→${colors.reset} ${file}`);
    }
    logOutput("");

    // Suggested fix
    logOutput(`${colors.bold}${colors.green}Suggested Fix:${colors.reset}`);
    const fixLines = result.suggestedFix.split("\n");
    let inCodeBlock = false;
    for (const fixLine of fixLines) {
      if (fixLine.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        if (fixLine.length > 3) {
          logOutput(`  ${colors.dim}─── ${fixLine.slice(3)} ───${colors.reset}`);
        } else {
          logOutput(`  ${colors.dim}${"─".repeat(40)}${colors.reset}`);
        }
      } else if (inCodeBlock) {
        // Syntax highlight code
        let highlighted = fixLine;
        if (fixLine.includes("// BUG") || fixLine.includes("// Before")) {
          highlighted = `${colors.red}${fixLine}${colors.reset}`;
        } else if (fixLine.includes("// After") || fixLine.includes("// fix") || fixLine.includes("// Use")) {
          highlighted = `${colors.green}${fixLine}${colors.reset}`;
        } else if (fixLine.trim().startsWith("//")) {
          highlighted = `${colors.dim}${fixLine}${colors.reset}`;
        } else if (fixLine.includes("const ")) {
          highlighted = fixLine.replace(/const /, `${colors.magenta}const ${colors.reset}`);
        }
        logOutput(`  ${highlighted}`);
      } else if (fixLine.trim()) {
        logOutput(`  ${fixLine}`);
      }
    }
    logOutput("");
  },
};
