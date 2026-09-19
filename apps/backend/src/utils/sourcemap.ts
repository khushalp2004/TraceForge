import { SourceMapConsumer, NullableMappedPosition } from "source-map";
import prisma from "../db/prisma.js";

interface StackFrame {
  line: string;
  func: string;
  file: string;
  lineNumber: number;
  columnNumber: number;
}

export async function resolveStackTrace(
  projectId: string,
  release: string | null,
  stackTrace: string
): Promise<string> {
  if (!release) return stackTrace;

  const lines = stackTrace.split("\n");
  const resolvedLines = [...lines];

  // Pattern: "    at Object.click (http://localhost:3000/static/js/main.12345.js:1:402)"
  const frameRegex = /^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)$/;
  // Alternative pattern without function name: "    at http://localhost:3000/static/js/main.12345.js:1:402"
  const alternativeFrameRegex = /^\s*at\s+(.+?):(\d+):(\d+)$/;

  const consumers: Record<string, SourceMapConsumer> = {};

  try {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match = frameRegex.exec(line);
      let funcName = "";
      let url = "";
      let lineNum = 0;
      let colNum = 0;

      if (match) {
        funcName = match[1];
        url = match[2];
        lineNum = parseInt(match[3], 10);
        colNum = parseInt(match[4], 10);
      } else {
        match = alternativeFrameRegex.exec(line);
        if (match) {
          url = match[1];
          lineNum = parseInt(match[2], 10);
          colNum = parseInt(match[3], 10);
        }
      }

      if (!match) continue;

      // Extract filename from URL (e.g. main.12345.js)
      const urlParts = url.split("/");
      const fileName = urlParts[urlParts.length - 1];

      if (!fileName.endsWith(".js")) continue;

      let consumer = consumers[fileName];

      if (!consumer && consumer !== null) {
        // Look up source map in DB
        const sourceMapRecord = await prisma.sourceMap.findUnique({
          where: {
            projectId_release_fileName: {
              projectId,
              release,
              fileName: fileName + ".map" // Assume typical naming convention
            }
          }
        });

        if (sourceMapRecord) {
          try {
            const rawSourceMap = JSON.parse(sourceMapRecord.content);
            consumer = await new SourceMapConsumer(rawSourceMap);
            consumers[fileName] = consumer;
          } catch (e) {
            console.error("Failed to parse source map JSON:", e);
            // @ts-ignore
            consumers[fileName] = null;
          }
        } else {
          // @ts-ignore
          consumers[fileName] = null;
        }
      }

      if (consumer) {
        const originalPosition: NullableMappedPosition = consumer.originalPositionFor({
          line: lineNum,
          column: colNum
        });

        if (originalPosition.source) {
          const origSource = originalPosition.source.replace(/^webpack:\/\//, ""); // clean up webpack paths
          const origLine = originalPosition.line;
          const origCol = originalPosition.column;
          const origName = originalPosition.name || funcName || "<anonymous>";

          resolvedLines[i] = `    at ${origName} (${origSource}:${origLine}:${origCol})`;
        }
      }
    }
  } finally {
    // Destroy all consumers to free WASM memory
    for (const key in consumers) {
      if (consumers[key]) {
        consumers[key].destroy();
      }
    }
  }

  return resolvedLines.join("\n");
}
