// cypress/support/e2e.js
// Global support file — runs before every spec.
// Reset localStorage auth state before each test to ensure a clean slate
beforeEach(() => {
  cy.window().then((win) => {
    win.localStorage.removeItem("mv_token");
    win.localStorage.removeItem("mv_refreshToken");
    win.localStorage.removeItem("mv_role");
  });
});
