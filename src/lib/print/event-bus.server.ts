import { EventEmitter } from "node:events";
import type { PrintJob } from "./types";

class PrintJobEventBus extends EventEmitter {
  emitJobUpdate(job: PrintJob) {
    this.emit(`job-update:${job.userId}`, job);
    this.emit(`job-status:${job.jobId}`, job);
  }

  subscribeUser(userId: string, listener: (job: PrintJob) => void) {
    const eventName = `job-update:${userId}`;
    this.on(eventName, listener);
    return () => {
      this.off(eventName, listener);
    };
  }

  subscribeJob(jobId: string, listener: (job: PrintJob) => void) {
    const eventName = `job-status:${jobId}`;
    this.on(eventName, listener);
    return () => {
      this.off(eventName, listener);
    };
  }
}

// Global singleton to persist across module reloads in node/serverless runtime
const globalWithBus = globalThis as unknown as { __printJobEventBus?: PrintJobEventBus };
if (!globalWithBus.__printJobEventBus) {
  globalWithBus.__printJobEventBus = new PrintJobEventBus();
  globalWithBus.__printJobEventBus.setMaxListeners(100);
}

export const printJobEventBus = globalWithBus.__printJobEventBus;
