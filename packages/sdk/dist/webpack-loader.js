const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
export default function traceForgeLoader(source) {
    let modifiedSource = source;
    let exportedMethods = [];
    methods.forEach(method => {
        // Matches: export async function GET OR export function GET
        const funcRegex = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`, 'g');
        // Matches: export const GET = 
        const arrowRegex = new RegExp(`export\\s+(const|let|var)\\s+${method}\\s*=`, 'g');
        let matched = false;
        if (funcRegex.test(modifiedSource)) {
            matched = true;
            modifiedSource = modifiedSource.replace(funcRegex, `const _tf_${method} = $1 function ${method}`);
        }
        if (arrowRegex.test(modifiedSource)) {
            matched = true;
            modifiedSource = modifiedSource.replace(arrowRegex, `const _tf_${method} =`);
        }
        if (matched) {
            exportedMethods.push(method);
        }
    });
    // If we found any API route exports, wrap them!
    if (exportedMethods.length > 0) {
        modifiedSource = `import { withTraceForge } from "usetraceforge/next";\n` +
            `import TraceForge from "usetraceforge";\n` +
            `TraceForge.init({ apiKey: process.env.NEXT_PUBLIC_TRACEFORGE_API_KEY, endpoint: process.env.NEXT_PUBLIC_TRACEFORGE_INGEST_URL });\n` +
            modifiedSource;
        exportedMethods.forEach(method => {
            modifiedSource += `\nexport const ${method} = withTraceForge(_tf_${method});`;
        });
    }
    return modifiedSource;
}
;
