// cypress/support/e2e.js
// Global support file — runs before every spec.
import "@testing-library/cypress/add-commands";

// Reset localStorage auth state before each test to ensure a clean slate
beforeEach(() => {
  cy.window().then((win) => {
    win.localStorage.removeItem("token");
    win.localStorage.removeItem("refreshToken");
    win.localStorage.removeItem("role");
  });
});
