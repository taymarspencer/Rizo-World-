// Release integrity: the build marker lives in four places and the service
// worker must cache every file the page loads. A mismatch shows players the
// recovery screen, or serves a stale file next to a new page.
const fs = require("fs"), path = require("path"), assert = require("assert");
const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const index = read("index.html"), sw = read("sw.js"), runtime = read("game-v79-defense.js");

let passed = 0, total = 0;
function test(name, fn) {
  total += 1;
  try { fn(); passed += 1; console.log("PASS", name); }
  catch (error) { console.log("FAIL", name, "\n   ", error.message); process.exitCode = 1; }
}

const build = (/<meta name="rizo-build" content="([^"]+)"/.exec(index) || [])[1];
const listed = name => {
  const match = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`).exec(sw);
  return match ? [...match[1].matchAll(/"\.\/([^"]*)"/g)].map(m => m[1]) : [];
};
const required = listed("REQUIRED_SHELL"), shell = listed("SHELL");
const loadedScripts = [...index.matchAll(/<script src="\.\/([^"]+)"><\/script>/g)].map(m => m[1]);
const loadedStyles = [...index.matchAll(/<link href="\.\/([^"]+\.css)" rel="stylesheet"/g)].map(m => m[1]);

test("page, boot shell, runtime and service worker carry one build marker", () => {
  assert(build, "index.html has no rizo-build meta");
  assert(index.includes(`const expected = "${build}";`), "boot shell expected build differs");
  assert(runtime.includes(`const RIZO_RUNTIME_BUILD = "${build}";`), "runtime build differs");
  assert(sw.includes(`const CACHE = "rizo-game-${build}";`), "service-worker cache name differs");
});
test("every script and stylesheet the page loads is a required, network-first shell file", () => {
  const missing = [...loadedScripts, ...loadedStyles].filter(file => !required.includes(file));
  assert.deepStrictEqual(missing, []);
});
test("every required shell file exists and is also in the full shell", () => {
  const absent = required.filter(file => file && !fs.existsSync(path.join(ROOT, file)));
  assert.deepStrictEqual(absent, []);
  assert.deepStrictEqual(required.filter(file => !shell.includes(file)), []);
});
test("core modules load before anything that depends on them", () => {
  const order = name => loadedScripts.indexOf(name);
  for (const core of ["core/rizo-save-core.js", "core/rizo-training.js", "core/rizo-modes.js"]) {
    assert(order(core) >= 0, `${core} is not loaded`);
    assert(order(core) < order("game-v79-defense.js"), `${core} must load before the hub`);
  }
});

console.log(`\n${passed}/${total} release integrity checks passed`);
