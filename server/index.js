#!/usr/bin/env node
import { createConfig } from "./config.js";
import { openDatabase } from "./db.js";
import { createWordwaveServer } from "./app.js";

const config = createConfig();
const db = openDatabase(config.dbFile);
const app = createWordwaveServer({ config, db });

const shownHost = config.host === "0.0.0.0" || config.host === "::" ? "127.0.0.1" : config.host;

app.server.listen(config.port, config.host, () => {
  console.log("");
  console.log("  WordWave Phonics 服务已启动");
  console.log(`  学习平台:  http://${shownHost}:${config.port}/`);
  console.log(`  管理后台:  http://${shownHost}:${config.port}/admin`);
  console.log(`  数据目录:  ${config.dataDir}`);
  console.log(`  支付模式:  ${config.paymentMode === "mock" ? "mock（测试，点击即开通）" : "manual（管理员确认收款）"}`);
  console.log("");
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[wordwave] 收到 ${signal}，正在关闭...`);
  clearInterval(app.cleanupInterval);
  app.server.close(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (error) => {
  console.error("[wordwave] unhandled rejection:", error);
});
