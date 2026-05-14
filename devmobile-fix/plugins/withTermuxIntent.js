const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withTermuxIntent(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [];
    }

    const alreadyAdded = manifest.queries.some((q) =>
      (q.package || []).some(
        (p) => p?.$ && p.$["android:name"] === "com.termux"
      )
    );

    if (!alreadyAdded) {
      manifest.queries.push({
        package: [{ $: { "android:name": "com.termux" } }],
      });
    }

    return config;
  });
};
