import fs from "fs";

import sqlite from "better-sqlite3";
import glob from "globby";

import { ROOT } from "../my";

async function main() {
  const sql = sqlite("my/files.db");
  sql.exec(/*sql*/ `
  CREATE TABLE IF NOT EXISTS [file] (
    [path]    TEXT PRIMARY KEY,
    [size]    FLOAT NOT NULL,
    [ext]     TEXT,
    [h]       TEXT
  );

  CREATE INDEX IF NOT EXISTS [file_size] ON [file]([size]);
  CREATE INDEX IF NOT EXISTS [file_ext] ON [file]([ext]);
  CREATE INDEX IF NOT EXISTS [file_h] ON [file]([h]);
  `);

  const batch: {
    path: string;
    size: number;
    ext: string;
  }[] = [];

  const insertMany = (bs: typeof batch) => {
    const insert = sql.prepare(/*sql*/ `
    INSERT OR REPLACE INTO [file] ([path], [size], [ext])
    VALUES (@path, @size, @ext)
    `);

    return sql.transaction(() => {
      bs.map((b) => insert.run(b));
    })();
  };

  let i = 0;

  for await (const file of glob.stream(ROOT)) {
    batch.push({
      path: file as string,
      size: fs.statSync(file).size,
      ext: (file as string).split(/(\.[A-Z0-9]+)$/i)[1],
    });

    if (batch.length >= 1000) {
      insertMany(batch.splice(0, 1000));
      console.log((i += 1000));
    }
  }

  insertMany(batch);

  sql.close();
}

if (require.main === module) {
  main().catch(console.error);
}
