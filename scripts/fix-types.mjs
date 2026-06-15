import fs from "fs";

const p = "lib/supabase/types.ts";
let c = fs.readFileSync(p, "utf8");

const tables = [...c.matchAll(/^      ([a-z_]+): \{/gm)].map((m) => m[1]);

for (let ti = tables.length - 1; ti >= 0; ti--) {
  const table = tables[ti];
  const marker = `      ${table}: {`;
  const idx = c.indexOf(marker);
  if (idx === -1) continue;

  const nextTable = ti < tables.length - 1 ? `      ${tables[ti + 1]}: {` : null;
  const endIdx = nextTable ? c.indexOf(nextTable, idx + marker.length) : c.indexOf("\n    };", idx);

  let slice = c.slice(idx, endIdx);
  if (slice.includes("Update: Partial")) continue;

  slice = slice.replace(
    /\r?\n\r?\n        Relationships: \[\];/,
    `\r\n        Update: Partial<Database["public"]["Tables"]["${table}"]["Row"]>;\r\n        Relationships: [];\r\n      };`
  );

  c = c.slice(0, idx) + slice + c.slice(endIdx);
}

fs.writeFileSync(p, c);
console.log("updates", (c.match(/Update: Partial/g) || []).length);
