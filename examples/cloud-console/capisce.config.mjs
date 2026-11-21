const RUST_FUNCTION = /^\s*pub(?:\(crate\))? (?:async )?fn (?<name>\w+)/;

export default {
  name: "Cloud console",
  sources: ["api/src", "console"],
  commands: { stamp: "make stamp" },
  extract: [
    { use: "./.capisce/rust_models.mjs", files: "api/src/db/models.rs" },
    {
      use: "routes",
      files: "api/src/external_api/*_endpoints.rs",
      definition: /^#\[endpoint \{/,
      pattern: /method = (?<method>\w+),\s*path = "(?<path>[^"]+)"/,
      span: 1,
    },
    {
      use: "functions",
      files: ["api/src/app/*.rs", "api/src/auth/*.rs", "api/src/db/*_store.rs"],
      exclude: ["**/mod.rs"],
      patterns: [RUST_FUNCTION],
    },
    { use: "./.capisce/console_actions.mjs", files: "console/*_actions.ts" },
    { use: "functions", files: ["console/api_client.ts", "console/error_messages.ts"] },
  ],
};
