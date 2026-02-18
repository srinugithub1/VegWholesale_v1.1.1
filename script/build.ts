import { build } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    // Client build is handled by package.json script now to avoid memory issues
    // console.log("Building client...");
    // execSync("npx vite build", { stdio: "inherit" });

    // Build server
    console.log("Building server...");
    await build({
        entryPoints: ["server/index.ts"],
        bundle: true,
        platform: "node",
        target: "node20",
        outfile: "dist/index.js",
        format: "esm",
        packages: "external", // Externalize dependencies to run with node_modules
        sourcemap: true,
    });

    console.log("Build complete.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
