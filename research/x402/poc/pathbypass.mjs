const BASE = process.env.SERVER || "http://127.0.0.1:4198";
const enc = s => s; // raw, we want the wire bytes exactly
const variants = [
  ["canonical",            "/api/cheap"],
  ["double slash",         "/api//cheap"],
  ["trailing slash",       "/api/cheap/"],
  ["case change",          "/API/cheap"],
  ["percent-encoded 'a'",  "/%61pi/cheap"],
  ["dot segment",          "/api/./cheap"],
  ["encoded slash",        "/api%2Fcheap"],
  ["leading double slash", "//api/cheap"],
  ["query junk",           "/api/cheap?a=1"],
  ["semicolon",            "/api/cheap;x=1"],
  ["%2e%2e trick",         "/api/x/../cheap"],
];
console.log("Payload-free GETs; a secure gateway must return 402 for every alias of a paid route.\n");
let bypasses = [];
for (const [label, path] of variants) {
  try {
    const r = await fetch(BASE + path, { redirect: "manual" });
    const text = await r.text();
    const paid = r.status === 402;
    const leaked = r.status === 200 && text.includes("cheap-value-42");
    if (leaked) bypasses.push({ label, path });
    console.log(`${paid ? "402 (gated)" : r.status === 200 ? (leaked ? "200 *** FREE RESOURCE ***" : "200 (redirect/other)") : String(r.status).padEnd(3)}  ${label.padEnd(22)} ${path}`);
  } catch (e) {
    console.log(`ERR  ${label} ${path}: ${e.message}`);
  }
}
console.log(`\nBYPASSES: ${bypasses.length ? JSON.stringify(bypasses) : "none"}`);
