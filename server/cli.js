#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { createUser, updateUser } from "./users.js";
import { nowIso } from "./security.js";

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i += 1;
      } else {
        out[key] = true;
      }
    } else {
      out._.push(arg);
    }
  }
  return out;
}

function usage() {
  console.log(`用法：
  node server/cli.js create-admin --username admin --password '至少8位密码' [--display-name 管理员]
  node server/cli.js reset-password --username admin --password '新密码'
  node server/cli.js backup [--out data/backups/wordwave.db]

环境变量：DATA_DIR、ADMIN_USERNAME、ADMIN_PASSWORD 等，见 .env.example。`);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
const config = createConfig();
const db = openDatabase(config.dbFile);

try {
  if (command === "create-admin") {
    const username = String(args.username || config.adminUsername || "admin");
    const password = String(args.password || config.adminPassword || "");
    if (!password) {
      console.error("错误：请通过 --password 或 ADMIN_PASSWORD 提供密码（至少 8 位）。");
      process.exitCode = 1;
    } else {
      const existing = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
      if (existing) {
        console.error(`错误：用户名 ${username} 已存在。如需重置密码请使用 reset-password。`);
        process.exitCode = 1;
      } else {
        const user = createUser(db, {
          username,
          password,
          displayName: args["display-name"] || "管理员",
          role: "admin"
        });
        console.log(`已创建管理员：${user.username}（ID ${user.id}）`);
      }
    }
  } else if (command === "reset-password") {
    const username = String(args.username || "");
    const password = String(args.password || "");
    if (!username || !password) {
      console.error("错误：需要 --username 和 --password。");
      process.exitCode = 1;
    } else {
      const user = db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username);
      if (!user) {
        console.error(`错误：用户 ${username} 不存在。`);
        process.exitCode = 1;
      } else {
        updateUser(db, user.id, { password });
        console.log(`已重置 ${user.username} 的密码，并撤销其所有登录会话。`);
      }
    }
  } else if (command === "backup") {
    const stamp = nowIso().replace(/[:.]/g, "-");
    const out = path.resolve(config.root, String(args.out || path.join(config.dataDir, "backups", `wordwave-${stamp}.db`)));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (fs.existsSync(out)) {
      console.error(`错误：备份文件已存在：${out}`);
      process.exitCode = 1;
    } else {
      db.prepare("VACUUM INTO ?").run(out);
      const size = fs.statSync(out).size;
      console.log(`备份完成：${out}（${(size / 1024).toFixed(1)} KB）`);
      console.log("提示：备份包含密码哈希和用户学习数据，请妥善保管，不要提交到 Git。");
    }
  } else {
    usage();
    if (!command) process.exitCode = 1;
  }
} catch (error) {
  console.error(`操作失败：${error.message}`);
  process.exitCode = 1;
} finally {
  try {
    db.close();
  } catch {
    // ignore
  }
}
