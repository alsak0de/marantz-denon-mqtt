#!/usr/bin/env node

import { loadDotEnv, readConfig } from "../src/marantz2mqtt/config.mjs";
import { Marantz2Mqtt } from "../src/marantz2mqtt/service.mjs";

loadDotEnv();

let service;

try {
  const config = readConfig();
  service = new Marantz2Mqtt(config);
  service.start();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    console.log(`${new Date().toISOString()} ${signal} received; stopping`);
    await service?.stop();
    process.exit(0);
  });
}
