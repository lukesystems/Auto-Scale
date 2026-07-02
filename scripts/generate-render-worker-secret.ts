import { randomBytes } from "node:crypto";

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const secret = randomBytes(32).toString("base64url");
const service = argValue("--service") ?? positional[0] ?? "autoscale-render-worker";
const region = argValue("--region") ?? positional[1] ?? "us-central1";

console.log("AUTOSCALE_RENDER_WORKER_SECRET");
console.log(secret);
console.log("");
console.log("PowerShell local session:");
console.log(`$env:AUTOSCALE_RENDER_WORKER_SECRET="${secret}"`);
console.log("");
console.log("Cloud Run update:");
console.log(
  `gcloud run services update ${service} --region ${region} --update-env-vars AUTOSCALE_RENDER_WORKER_SECRET=${secret}`
);
console.log("");
console.log("Vercel production env:");
console.log("vercel env add AUTOSCALE_RENDER_WORKER_SECRET production");
console.log("Paste the secret above when prompted.");
console.log("");
console.log("Verify after Cloud Run and Vercel use the same value:");
console.log("VERIFY_WORKER_LIVE=1 npm run verify:loop1-production");
