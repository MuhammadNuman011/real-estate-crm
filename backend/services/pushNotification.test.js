const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { createPushNotificationService } = require("./pushNotification");

function ledgerPath(name) {
  return path.join(os.tmpdir(), "property-notifications-" + name + "-" + process.pid + ".json");
}

function remove(file) {
  fs.rmSync(file, { force: true });
  fs.rmSync(file + ".tmp", { force: true });
}

test("sends one topic notification after a property is saved", async function() {
  const file = ledgerPath("once");
  const sent = [];
  const service = createPushNotificationService({
    ledgerPath: file,
    credential: null,
    send: async function(message) {
      sent.push(message);
    }
  });

  const property = {
    id: 15,
    title: "Marina View",
    property_type: "Apartment",
    bedrooms: 2
  };

  const first = await service.notifyNewProperty(property);
  const second = await service.notifyNewProperty(property);

  assert.equal(first.sent, true);
  assert.deepEqual(second, { sent: false, reason: "already_sent" });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].topic, "all_users");
  assert.equal(sent[0].notification.title, "New Property Available!");
  assert.equal(sent[0].notification.body, "Marina View is now available.");
  assert.equal(sent[0].data.notificationType, "NEW_PROPERTY");
  assert.equal(sent[0].data.propertyId, "15");
  assert.equal(sent[0].android.notification.channelId, "property_alerts");
  remove(file);
});

test("uses the property type when a title is missing", function() {
  const service = createPushNotificationService({
    ledgerPath: ledgerPath("label"),
    credential: null,
    send: async function() {}
  });
  assert.equal(
    service.notificationBody({ property_type: "Villa", bedrooms: 3 }),
    "3 BR Villa is now available."
  );
});

test("does not record a failed send", async function() {
  const file = ledgerPath("retry");
  let fail = true;
  const sent = [];
  const service = createPushNotificationService({
    ledgerPath: file,
    credential: null,
    send: async function(message) {
      if (fail) throw new Error("unavailable");
      sent.push(message);
    }
  });

  const first = await service.notifyNewProperty({ id: 4, title: "Creek" });
  fail = false;
  const second = await service.notifyNewProperty({ id: 4, title: "Creek" });

  assert.equal(first.sent, false);
  assert.equal(first.reason, "firebase_error");
  assert.equal(second.sent, true);
  assert.equal(sent.length, 1);
  remove(file);
});

test("does not send when the property has no id", async function() {
  const file = ledgerPath("missing");
  let calls = 0;
  const service = createPushNotificationService({
    ledgerPath: file,
    credential: null,
    send: async function() {
      calls += 1;
    }
  });

  const result = await service.notifyNewProperty({ title: "No id" });
  assert.deepEqual(result, { sent: false, reason: "missing_id" });
  assert.equal(calls, 0);
  assert.equal(fs.existsSync(file), false);
});

test("skips sending when Firebase credentials are missing", async function() {
  const file = ledgerPath("unconfigured");
  const service = createPushNotificationService({
    ledgerPath: file,
    credential: null
  });

  const result = await service.notifyNewProperty({ id: 8, title: "Bay" });
  assert.deepEqual(result, { sent: false, reason: "not_configured" });
  assert.equal(fs.existsSync(file), false);
});

test("parallel sends for the same property share one delivery", async function() {
  const file = ledgerPath("parallel");
  let calls = 0;
  const service = createPushNotificationService({
    ledgerPath: file,
    credential: null,
    send: function() {
      calls += 1;
      return new Promise(function(resolve) {
        setTimeout(resolve, 20);
      });
    }
  });

  const results = await Promise.all([
    service.notifyNewProperty({ id: 21, title: "Palm" }),
    service.notifyNewProperty({ id: 21, title: "Palm" })
  ]);

  assert.equal(calls, 1);
  assert.equal(results.filter(function(result) { return result.sent; }).length, 2);
  remove(file);
});
