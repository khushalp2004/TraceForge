import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function withTraceForgeConfig(nextConfig = {}) {
    return {
        ...nextConfig,
        turbopack: nextConfig.turbopack || {},
        webpack(config, options) {
            // Add our custom loader to the Webpack rules
            config.module.rules.push({
                test: /app\/api\/.*\/route\.(ts|js|tsx|jsx)$/,
                use: [
                    {
                        // Point to our compiled ESM loader
                        loader: path.resolve(__dirname, 'webpack-loader.js'),
                    },
                ],
            });
            // Call the user's existing webpack config if they have one
            if (typeof nextConfig.webpack === 'function') {
                return nextConfig.webpack(config, options);
            }
            return config;
        },
    };
}
