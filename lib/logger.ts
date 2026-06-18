type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: string;
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: Error
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context && { context }),
    ...(error && { error: error.message }),
  };
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    try {
      const entry = createLogEntry("debug", message, context);
      console.log(JSON.stringify(entry));
    } catch {
      // Never throw, even if logging fails
    }
  },

  info(message: string, context?: Record<string, unknown>) {
    try {
      const entry = createLogEntry("info", message, context);
      console.log(JSON.stringify(entry));
    } catch {
      // Never throw
    }
  },

  warn(message: string, context?: Record<string, unknown>) {
    try {
      const entry = createLogEntry("warn", message, context);
      console.log(JSON.stringify(entry));
    } catch {
      // Never throw
    }
  },

  error(message: string, error?: Error, context?: Record<string, unknown>) {
    try {
      const entry = createLogEntry("error", message, context, error);
      console.log(JSON.stringify(entry));
    } catch {
      // Never throw, even if logging the error fails
    }
  },
};
