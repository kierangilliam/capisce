const plumbing = ["**/*_test.go", "internal/accounts/directory.go", "internal/tickets/service.go"];
const go_function = (name) => new RegExp(`^func (?:\\(\\w+ \\*?(?<receiver>\\w+)\\) )?(?<name>${name})[\\[(]`);
const any_name = "\\w+";
const exported_and_not_a_constructor = "(?!New[A-Z])[A-Z]\\w*";

export default {
  name: "Help desk",
  sources: ["cmd", "internal", "web"],
  commands: { stamp: "make map-stamp" },
  timings: "./.capisce/timings.mjs",
  extract: [
    { use: "./.capisce/models.mjs", files: "internal/*/models.go" },
    {
      use: "functions",
      module: "folder",
      files: "internal/tickets/*.go",
      exclude: plumbing,
      patterns: [go_function(any_name)],
    },
    {
      use: "functions",
      module: "folder",
      files: ["internal/accounts/*.go", "internal/deadlines/*.go", "internal/notify/*.go"],
      exclude: plumbing,
      patterns: [go_function(exported_and_not_a_constructor)],
    },
    {
      use: "functions",
      module: "folder",
      files: ["web/auth.go", "web/respond.go"],
      patterns: [go_function("signedIn|readJSON|writeError")],
    },
    {
      use: "routes",
      files: "web/routes.go",
      definition: /^\s*mux\.HandleFunc\(/,
      pattern: /HandleFunc\("(?<method>[A-Z]+) (?<path>[^"]+)"/,
      span: 1,
    },
  ],
};
