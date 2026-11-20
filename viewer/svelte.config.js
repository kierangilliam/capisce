import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const QUIET_WARNINGS = ["a11y_click_events_have_key_events", "a11y_no_static_element_interactions"];

export default {
  preprocess: vitePreprocess(),
  compilerOptions: { warningFilter: (warning) => !QUIET_WARNINGS.includes(warning.code) },
};
