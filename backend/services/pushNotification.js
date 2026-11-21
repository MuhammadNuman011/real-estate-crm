const fs = require("fs");
const path = require("path");

const TOPIC = "all_users";
const TYPE = "NEW_PROPERTY";
const TITLE = "New Property Available!";
const CHANNEL_ID = "property_alerts";
const DEFAULT_LEDGER = path.join(__dirname, "../storage/property-notification-ledger.json");
const SEND_TIMEOUT_MS = 10000;

const inflight = new Map();

function clean(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function propertyId(property) {
  if (!property || property.id == null) return "";
  const id = String(property.id).trim();
  if (!/^[1-9]\d*$/.test(id)) return "";
  return id;
}

function propertyLabel(property) {
  const title = clean(property && property.title);
  if (title) return title.slice(0, 120);
  const type = clean(property && property.property_type);
  const bedrooms = Number(property && property.bedrooms);
  if (type && Number.isInteger(bedrooms) && bedrooms > 0) {
    return bedrooms + " BR " + type;
  }
  return type || "A new listing";
}

function notificationBody(property) {
  const body = propertyLabel(property) + " is now available.";
  if (body.length <= 180) return body;
  return body.slice(0, 177).trimEnd() + "...";
}

function readLedger(ledgerPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(function(id) {
      return String(id);
    });
  } catch (error) {
    return [];
  }
}

function writeLedger(ledgerPath, ids) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const seen = new Set();
  const unique = [];
  ids.forEach(function(id) {
    const key = String(id);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(key);
  });
  const trimmed = unique.slice(-5000);
  fs.writeFileSync(ledgerPath, JSON.stringify(trimmed));
  return trimmed;
}

function loadServiceAccount(options) {
  if (Object.prototype.hasOwnProperty.call(options, "credential")) {
    return options.credential;
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json && json.trim()) {
    return JSON.parse(json);
  }

  const file = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!file || !file.trim()) return null;
  const resolved = path.isAbsolute(file) ? file : path.resolve(__dirname, "..", file);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function createPushNotificationService(options) {
  const settings = options || {};
  const ledgerPath = settings.ledgerPath || DEFAULT_LEDGER;
  let messagingClient;
  let initAttempted = false;

  function messaging() {
    if (initAttempted) return messagingClient || null;
    initAttempted = true;
    try {
      const account = loadServiceAccount(settings);
      if (!account) {
        console.warn(
          "Property notifications are disabled. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH."
        );
        return null;
      }
      const admin = require("firebase-admin");
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(account)
        });
      }
      messagingClient = admin.messaging();
      return messagingClient;
    } catch (error) {
      console.error("Firebase Admin could not be initialized:", error);
      return null;
    }
  }

  function deliver(message) {
    if (typeof settings.send === "function") return settings.send(message);
    const client = messaging();
    if (!client) {
      const error = new Error("Firebase messaging is not configured.");
      error.code = "not_configured";
      throw error;
    }
    return client.send(message);
  }

  function withTimeout(promise) {
    return new Promise(function(resolve, reject) {
      const timer = setTimeout(function() {
        reject(new Error("Firebase notification timed out."));
      }, settings.timeoutMs || SEND_TIMEOUT_MS);
      promise.then(function(value) {
        clearTimeout(timer);
        resolve(value);
      }, function(error) {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  async function sendOnce(property, id) {
    const alreadySent = readLedger(ledgerPath);
    if (alreadySent.indexOf(id) !== -1) {
      return { sent: false, reason: "already_sent" };
    }

    const message = {
      topic: TOPIC,
      notification: {
        title: TITLE,
        body: notificationBody(property)
      },
      data: {
        notificationType: TYPE,
        propertyId: id
      },
      android: {
        priority: "high",
        notification: {
          channelId: CHANNEL_ID
        }
      },
      apns: {
        headers: {
          "apns-priority": "10"
        },
        payload: {
          aps: {
            sound: "default"
          }
        }
      }
    };

    try {
      await withTimeout(Promise.resolve(deliver(message)));
    } catch (error) {
      if (error && error.code === "not_configured") {
        return { sent: false, reason: "not_configured" };
      }
      console.error("New property notification failed:", error);
      return { sent: false, reason: "firebase_error" };
    }

    writeLedger(ledgerPath, alreadySent.concat(id));
    return { sent: true };
  }

  function notifyNewProperty(property) {
    const id = propertyId(property);
    if (!id) return Promise.resolve({ sent: false, reason: "missing_id" });

    const pending = inflight.get(ledgerPath + ":" + id);
    if (pending) return pending;

    const run = sendOnce(property, id).finally(function() {
      inflight.delete(ledgerPath + ":" + id);
    });
    inflight.set(ledgerPath + ":" + id, run);
    return run;
  }

  return {
    notifyNewProperty: notifyNewProperty,
    notificationBody: notificationBody,
    propertyLabel: propertyLabel
  };
}

const service = createPushNotificationService();
service.createPushNotificationService = createPushNotificationService;
service.TOPIC = TOPIC;
service.TYPE = TYPE;

module.exports = service;
