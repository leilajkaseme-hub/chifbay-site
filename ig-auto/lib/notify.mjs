// notify.mjs — push messages to the ntfy topics the other Chifbay jobs
// already use, so alerts land in the same phone app as the blog and reviews
// automation instead of inventing a new channel.
//
// Notifications are always best-effort. A failed ping must never fail a run
// that otherwise worked, and must never stop a post going out.
import { config } from "./queue.mjs";

async function send(topic, title, message, { priority = "default", tags = "boat" } = {}) {
  if (!topic) return;
  try {
    await fetch(topic, {
      method: "POST",
      headers: { Title: title, Priority: priority, Tags: tags },
      body: message,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    console.warn(`ntfy failed (ignored): ${err.message}`);
  }
}

export const alert = (title, message) =>
  send(config.ntfy.alerts, title, message, { priority: "high", tags: "rotating_light,boat" });

export const inbox = (title, message) =>
  send(config.ntfy.inbox, title, message, { priority: "default", tags: "camera,boat" });
