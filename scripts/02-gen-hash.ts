import crypto from "crypto";
import fs from "fs";

import sqlite from "better-sqlite3";
import filesize from "filesize";

async function main() {
  const sql = sqlite("my/files.db");
  sql.function("filesize", (size: number) => size.toExponential(2));

  const updates: {
    f: string;
    h: string;
  }[] = [];

  for (const { ps } of sql
    .prepare(
      /*sql*/ `
  SELECT ps
  FROM (
    SELECT
      json_group_array([path]) ps,
      count([path]) c,
      filesize([size]) s,
      lower([ext]) as x
    FROM [file]
    WHERE x IN ('.jpg', '.png', '.gif', '.bmp')
    GROUP BY s, x
  )
  WHERE c > 1
  ORDER BY c DESC
  `
    )
    .iterate()) {
    try {
      const files: string[] = JSON.parse(ps);
      files.map((f) => {
        updates.push({
          f,
          h: crypto
            .createHash("sha256")
            .update(fs.readFileSync(f))
            .digest()
            .toString("base64"),
        });
      });
    } catch (e) {
      console.error(e);
    }
  }

  console.log("writing");

  const stmt = sql.prepare(/*sql*/ `
    UPDATE [file]
    SET h = @h
    WHERE [path] = @f
  `);
  sql.transaction(() => {
    updates.map((u) => stmt.run(u));
  })();

  sql.close();
}

if (require.main === module) {
  main().catch(console.error);
}
