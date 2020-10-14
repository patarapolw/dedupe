import fs from "fs";

import sqlite from "better-sqlite3";
import filesize from "filesize";
import yaml from "js-yaml";

async function main() {
  const sql = sqlite("my/files.db");
  sql.function("filesize", (size: number) => size.toExponential(2));

  const sorted: {
    size: number;
    files: string[];
    count: number;
  }[] = [];

  for (const { ps, c: count, size } of sql
    .prepare(
      /*sql*/ `
  SELECT ps, c, [size], x
  FROM (
    SELECT
      json_group_array([path]) ps,
      count([path]) c,
      [size],
      filesize([size]) s,
      lower([ext]) as x
    FROM [file]
    WHERE x NOT IN ('.js', '.htm', '.html', '.db', '.pcg', '.exe')
    GROUP BY s, x, h
  )
  WHERE c > 1
  ORDER BY c DESC
  LIMIT 10
  `
    )
    .iterate()) {
    try {
      sorted.push({
        size,
        count,
        files: JSON.parse(ps),
      });
    } catch (e) {
      console.error(e);
    }
  }

  fs.writeFileSync(
    "my/dupe.yaml",
    yaml.safeDump(
      sorted
        .sort(({ size: s1 }, { size: s2 }) => s2 - s1)
        .map(({ size, count, files }) => ({
          filesize: filesize(size),
          count,
          files,
        }))
    )
  );

  sql.close();
}

if (require.main === module) {
  main().catch(console.error);
}
