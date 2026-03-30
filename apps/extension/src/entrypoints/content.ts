import type { AutofillResponse } from "@/lib/messages";
import "./content/autofill.css";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  cssInjectionMode: "manifest",
  main() {
    let activeIcon: HTMLElement | null = null;
    let activeDropdown: HTMLElement | null = null;

    function findPasswordFields(): HTMLInputElement[] {
      return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]'));
    }

    function findUsernameField(passwordField: HTMLInputElement): HTMLInputElement | null {
      const form = passwordField.closest("form");
      const container = form ?? passwordField.parentElement?.parentElement ?? document.body;

      const byAutocomplete = container.querySelector<HTMLInputElement>(
        'input[autocomplete="username"], input[autocomplete="email"]',
      );
      if (byAutocomplete) return byAutocomplete;

      const byType = container.querySelector<HTMLInputElement>('input[type="email"]');
      if (byType) return byType;

      const allInputs = Array.from(
        container.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="email"], input:not([type])'),
      );
      const pattern = /user|email|login|account/i;
      const byName = allInputs.find(
        (i) => pattern.test(i.name) || pattern.test(i.id) || pattern.test(i.placeholder),
      );
      if (byName) return byName;

      const allVisible = allInputs.filter((i) => i.offsetParent !== null);
      const pwIndex = Array.from(container.querySelectorAll("input")).indexOf(passwordField);
      const prior = allVisible.filter(
        (i) => Array.from(container.querySelectorAll("input")).indexOf(i) < pwIndex,
      );
      return prior[prior.length - 1] ?? null;
    }

    function cleanup() {
      activeIcon?.remove();
      activeIcon = null;
      activeDropdown?.remove();
      activeDropdown = null;
    }

    function fillField(input: HTMLInputElement, value: string) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(input, value);
      } else {
        input.value = value;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function fillCredentials(
      passwordField: HTMLInputElement,
      credential: { username: string; password: string },
    ) {
      const usernameField = findUsernameField(passwordField);
      if (usernameField && credential.username) {
        fillField(usernameField, credential.username);
      }
      fillField(passwordField, credential.password);
      cleanup();
    }

    function showDropdown(
      passwordField: HTMLInputElement,
      entries: AutofillResponse["entries"],
    ) {
      activeDropdown?.remove();

      const dropdown = document.createElement("div");
      dropdown.className = "vp-autofill-dropdown";

      entries.forEach((entry) => {
        const btn = document.createElement("button");
        btn.className = "vp-autofill-item";
        btn.innerHTML = `
          <div class="vp-autofill-item-name">${escapeHtml(entry.name)}</div>
          <div class="vp-autofill-item-user">${escapeHtml(entry.username)}</div>
        `;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          fillCredentials(passwordField, entry);
        });
        dropdown.appendChild(btn);
      });

      document.body.appendChild(dropdown);
      const rect = passwordField.getBoundingClientRect();
      dropdown.style.position = "fixed";
      dropdown.style.top = `${rect.bottom + 4}px`;
      dropdown.style.left = `${rect.left}px`;
      activeDropdown = dropdown;

      const closeHandler = (e: MouseEvent) => {
        if (!dropdown.contains(e.target as Node)) {
          dropdown.remove();
          activeDropdown = null;
          document.removeEventListener("click", closeHandler, true);
        }
      };
      setTimeout(() => document.addEventListener("click", closeHandler, true), 0);
    }

    function showAutofillIcon(
      passwordField: HTMLInputElement,
      entries: AutofillResponse["entries"],
    ) {
      cleanup();

      const icon = document.createElement("div");
      icon.className = "vp-autofill-icon";
      icon.textContent = "VP";
      icon.title = "Vault Prime \u2014 fill credentials";

      icon.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (entries.length === 1) {
          fillCredentials(passwordField, entries[0]);
        } else {
          showDropdown(passwordField, entries);
        }
      });

      document.body.appendChild(icon);
      const rect = passwordField.getBoundingClientRect();
      icon.style.position = "fixed";
      icon.style.top = `${rect.top + (rect.height - 24) / 2}px`;
      icon.style.left = `${rect.right - 30}px`;
      activeIcon = icon;
    }

    async function scanForForms() {
      const passwordFields = findPasswordFields();
      if (passwordFields.length === 0) return;

      try {
        const res = (await browser.runtime.sendMessage({
          action: "checkAutofill",
          url: location.href,
        })) as AutofillResponse;

        if (res.entries.length > 0) {
          const visible = passwordFields.find((f) => f.offsetParent !== null);
          if (visible) {
            showAutofillIcon(visible, res.entries);
          }
        }
      } catch {
        // Extension context invalidated or vault locked
      }
    }

    function escapeHtml(str: string): string {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    // Initial scan
    scanForForms();

    // Watch for dynamically added forms (SPAs)
    const observer = new MutationObserver(() => {
      const passwordFields = findPasswordFields();
      if (passwordFields.length > 0 && !activeIcon) {
        scanForForms();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  },
});
