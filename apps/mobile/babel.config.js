const path = require("path");

module.exports = function (api) {
  api.cache(true);
  const sharedRoot = process.env.DIRAOS_REAL_WORKSPACE_ROOT
    ? path.join(process.env.DIRAOS_REAL_WORKSPACE_ROOT, "packages/shared/src")
    : "../../packages/shared/src";
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": "./src",
            "@shared": sharedRoot
          }
        }
      ]
    ]
  };
};
