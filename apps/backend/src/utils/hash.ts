import crypto from "crypto";

export const hashErrorSignature = (message: string, stackTrace: string) => {
  // 1. Extract the Error Name (e.g., TypeError, ReferenceError)
  const errorNameMatch = message.match(/^([A-Za-z0-9_]+Error)/);
  const baseError = errorNameMatch ? errorNameMatch[1] : message.split(':')[0];

  // 2. Extract function calls from stack trace
  const frames = stackTrace.split('\n');
  const functionCalls: string[] = [];
  
  for (const frame of frames) {
    // Match "at FunctionName (..." or "at FunctionName"
    const functionMatch = frame.match(/^\s*at\s+([A-Za-z0-9_$.<>]+)/);
    if (functionMatch && functionMatch[1]) {
      functionCalls.push(functionMatch[1]);
    }
  }

  // 3. Fallback: if no function calls were successfully parsed (unrecognized stack format),
  // we clean the raw stack trace by stripping numbers to ignore dynamic IDs/Line numbers.
  let cleanedStack = functionCalls.slice(0, 3).join('|');
  if (!cleanedStack) {
      cleanedStack = stackTrace.replace(/[0-9]+/g, '');
  }

  const signature = `${baseError}\n${cleanedStack}`;
  return crypto.createHash("sha256").update(signature).digest("hex");
};
