// Training games reach the world only through their run services. These are
// the reach-ins the hub-era arcade code had, and none may come back.
const fs = require("fs"), path = require("path"), assert = require("assert");
const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "training");
const files = fs.readdirSync(DIR).filter(name => name.endsWith(".js")).sort();

let passed = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); passed += 1; console.log("PASS", name); }
  catch (error) { console.log("FAIL", name, "\n   ", error.message); process.exitCode = 1; }
}

const FORBIDDEN = [
  [/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/, "storage (the save belongs to the hub)"],
  [/\bstate\.|\bsaveState\b|\bmutate\(/, "the hub's state"],
  [/\bDate\.now\(|\bperformance\.now\(/, "a wall clock (use run.now())"],
  [/\bsetTimeout\(|\bsetInterval\(|\brequestAnimationFrame\(/, "a raw timer (use run.after / run.every; the runner owns the frame)"],
  [/\baddEventListener\(/, "a global listener (the runner routes input to the game's hooks)"],
  [/\bRizoRuntimeQA\s*=|\bwindow\.RizoRuntimeQA\s*=/, "assigning the QA namespace"],
  [/\bRizoModes\b|\bRizoSaveCore\b|\bRizoDefense/, "another layer's module"]
];

test("there is one file per game plus the shared kit", () => {
  assert.deepStrictEqual(files, ["breaker.js", "forage.js", "glide.js", "kit.js", "maze.js", "memory.js", "power.js", "rhythm.js", "rush.js", "spark.js", "walk.js"]);
});
for (const name of files) {
  const source = fs.readFileSync(path.join(DIR, name), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")       // comments may mention the old ways
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  test(`${name} stays inside its run`, () => {
    const hits = FORBIDDEN.filter(([pattern]) => pattern.test(source)).map(([, why]) => why);
    assert.deepStrictEqual(hits, []);
  });
}
test("each game registers exactly once, under its file name", () => {
  for (const name of files.filter(file => file !== "kit.js")) {
    const source = fs.readFileSync(path.join(DIR, name), "utf8");
    const ids = [...source.matchAll(/RizoTraining\.register\(\{\s*id: "([a-z]+)"/g)].map(match => match[1]);
    assert.deepStrictEqual(ids, [name.replace(/\.js$/, "")], name);
  }
});

console.log(`\n${passed}/${total} training boundary checks passed`);
