const Features = require("../modals/Feature");

const BROKER_MANAGE_PROPERTIES = "broker_manage_properties";

async function isFeatureEnabled(key) {
  const feature = await Features.findOne({
    where: { key: key },
    attributes: ["enabled"],
  });
  return Boolean(feature && feature.enabled);
}

async function ensureDefaultFeatures() {
  await Features.findOrCreate({
    where: { key: BROKER_MANAGE_PROPERTIES },
    defaults: {
      key: BROKER_MANAGE_PROPERTIES,
      enabled: true,
      description: "Allows brokers to add and update properties.",
    },
  });
}

module.exports = {
  BROKER_MANAGE_PROPERTIES,
  isFeatureEnabled,
  ensureDefaultFeatures,
};
