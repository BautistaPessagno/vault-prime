import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Vault Prime",
    version: "0.1.0",
    description: "Zero-knowledge password manager",
    permissions: ["storage", "activeTab", "alarms"],
    host_permissions: ["<all_urls>"],
  },
});
