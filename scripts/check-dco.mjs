import { execFileSync } from "node:child_process";

const [base, head] = process.argv.slice(2);
const shaPattern = /^[0-9a-f]{40}$/i;

if (!base || !head || !shaPattern.test(base) || !shaPattern.test(head)) {
  console.error("Usage: node scripts/check-dco.mjs <base-sha> <head-sha>");
  process.exit(2);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

try {
  git(["cat-file", "-e", `${base}:DCO.md`]);
} catch {
  console.log("DCO policy is not present on the target branch yet; adoption baseline, skipping legacy history.");
  process.exit(0);
}

const commits = git(["rev-list", "--no-merges", `${base}..${head}`]).split("\n").filter(Boolean);
const signoff = /^Signed-off-by:\s+[^<>\r\n]+\s+<[^<>\s@]+@[^<>\s@]+>\s*$/im;
const missing = [];

for (const commit of commits) {
  const message = git(["show", "-s", "--format=%B", commit]);
  if (!signoff.test(message)) missing.push(commit);
}

if (missing.length) {
  console.error("Each commit must include a DCO Signed-off-by trailer (use git commit -s):");
  for (const commit of missing) console.error(`  ${commit}`);
  process.exit(1);
}

console.log(`DCO verified for ${commits.length} commit(s).`);
