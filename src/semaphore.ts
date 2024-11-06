import { EventEmitter } from "node:events";

// Give a random delay between 0ms and 50ms;
const randomDelay = () =>
  new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

export const holders: LicenseHolder[] = [
  { name: "Alice" },
  { name: "Bob" },
  { name: "Charlie" },
  { name: "Diana" },
  { name: "Eve" },
  { name: "Frank" },
  { name: "Grace" },
  { name: "Hank" },
  { name: "Ivy" },
  { name: "Jack" }
];

type License = {
  name: string;
  at: Date | null;
  status: "ACTIVE" | "UNACTIVE";
}[];
class RemoteLib {
  private MAX_CONCURRENT_READERS: number = 3;
  private semaphoreTraffic: boolean = true;
  private licensesInUse: number = 0;

  standBy: License = [];
  licenses: License = [];

  static #instance: RemoteLib;
  private constructor() {}
  public static get instance() {
    if (!this.#instance) {
      this.#instance = new RemoteLib();
    }

    return this.#instance;
  }

  async acquire(name: string) {
    await randomDelay();
    const alreadyHaveLicense = this.licenses.find(
      (license) => license.name === name
    );

    if (
      this.licensesInUse === this.MAX_CONCURRENT_READERS ||
      alreadyHaveLicense
    ) {
      if (this.licensesInUse === this.MAX_CONCURRENT_READERS) {
        this.standBy.push({ name, at: null, status: "UNACTIVE" });
      }

      console.log("Não há licensa disponível para ser adquirida!");
    } else {
      this.licensesInUse += 1;
      this.licenses.push({ name, at: new Date(), status: "ACTIVE" });
      console.log(`Usuário: ${name} resgatou uma licensa!`);
      if (
        !this.semaphoreTraffic &&
        this.licensesInUse === this.MAX_CONCURRENT_READERS
      ) {
        this.semaphoreTraffic = false;
      }
    }
  }

  async release(name: string) {
    await randomDelay();
    const license = this.licenses.findIndex((license) => license.name === name);

    if (license === -1 || this.licenses[license].status === "UNACTIVE") return;
    this.licensesInUse -= 1;
    this.semaphoreTraffic = true;
    this.licenses[license].status = "UNACTIVE";

    if (this.standBy.length > 0) {
      const nxtHolder = this.standBy.at(-1);
      if (nxtHolder) {
        this.acquire(nxtHolder.name);
        this.standBy.pop();
      }
    }

    console.log("Licensa disponível para ser adquirida!");
  }
}

interface LicenseHolder {
  name: string;
}

class HolderActions {
  holder: LicenseHolder;
  at: Date;

  constructor(private remoteLib: RemoteLib) {}
  claim(holder: LicenseHolder) {
    this.holder = holder;
    this.at = new Date();
    this.remoteLib.acquire(this.holder.name);
  }

  async revoke(holder: LicenseHolder) {
    await this.remoteLib.release(holder.name);
  }
}

class HolderEvents extends EventEmitter {
  static #instance: HolderEvents;
  private constructor() {
    super();
  }

  public static get instance() {
    if (!this.#instance) {
      this.#instance = new HolderEvents();
    }

    return this.#instance;
  }
}

const remoteLib = RemoteLib.instance;
const holderActions = new HolderActions(remoteLib);
const holderActionsEvents = HolderEvents.instance;
function hearHolderActions() {
  console.log("Listening events!");
  holderActionsEvents.on("revoke", async (msg: string) => {
    const holder = holders.find((holder) => holder.name === msg);
    if (!holder) {
      return;
    }

    holderActions.revoke(holder);
  });
}

setTimeout(() => {
  for (const holder of holders) {
    holderActions.claim(holder);
  }
}, 2000);

setInterval(() => {
  const data = remoteLib.licenses.find(
    (license) => license.status === "ACTIVE"
  );

  if (!data) process.stdout.end();
  if (data) holderActionsEvents.emit("revoke", data.name);
}, 3000);

hearHolderActions();
process.stdin.resume();
