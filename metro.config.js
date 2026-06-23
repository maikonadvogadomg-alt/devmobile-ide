const { getDefaultConfig } = require("expo/metro-config");
  const path = require("path");

  const config = getDefaultConfig(__dirname);

  // Exclui pastas que não são React Native (API server, code editor, etc.)
  config.watchFolders = [__dirname];
  config.resolver = {
    ...config.resolver,
    blockList: [
      /artifacts[\/]api-server[\/].*/,
      /artifacts[\/]code-editor[\/].*/,
      /devmobile-fix[\/].*/,
      /server[\/].*/,
    ],
  };

  module.exports = config;
  