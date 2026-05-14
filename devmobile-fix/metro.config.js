const { getDefaultConfig } = require("@expo/metro-config");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const projectRoot = __dirname;

const config = getDefaultConfig(__dirname);

// Monorepo: include workspace root so Metro can resolve shared packages
config.watchFolders = [
  ...(config.watchFolders || []),
  workspaceRoot,
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Garante que só existe UMA cópia do React (evita "Invalid hook call")
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceRoot, "node_modules/react"),
  "react-dom": path.resolve(workspaceRoot, "node_modules/react-dom"),
  "react-native": path.resolve(workspaceRoot, "node_modules/react-native"),
};

module.exports = config;
