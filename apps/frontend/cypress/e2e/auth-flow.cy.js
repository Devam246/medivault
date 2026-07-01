/**
 * E2E Spec: Authentication Flow
 *
 * Covers:
 *  - Landing page renders and has a Login CTA
 *  - Register page: fills form and submits
 *  - Login page: fills credentials, selects role, submits
 *  - Redirected to the correct dashboard after login
 *  - Unauthenticated access to a protected route redirects to /login
 */

describe("Authentication Flow", () => {
  beforeEach(() => {
    // Stub API calls so the frontend runs standalone
    cy.intercept("POST", "**/auth/register", {
      statusCode: 200,
      body: { message: "Patient registered successfully" },
    }).as("registerRequest");

    cy.intercept("POST", "**/auth/login", {
      statusCode: 200,
      body: {
        token: "fake-access-token",
        refreshToken: "fake-refresh-token",
        role: "patient",
      },
    }).as("loginRequest");
  });

  it("landing page has login CTA", () => {
    cy.visit("/");
    cy.contains("Login").should("be.visible");
  });

  it("register page: fills and submits registration form", () => {
    cy.visit("/register");
    cy.get("input[placeholder*='name' i]").first().type("Alice Smith");
    cy.get("input[type='email']").type("alice@example.com");
    cy.get("input[type='password']").first().type("securepass123");
    cy.get("form").submit();
    cy.wait("@registerRequest").its("request.body").should("include", {
      email: "alice@example.com",
    });
  });

  it("login page: patient logs in and reaches patient dashboard", () => {
    cy.visit("/login");

    cy.get("input[type='email']").type("alice@example.com");
    cy.get("input[type='password']").type("securepass123");

    // Select patient role (default is patient — just confirm button active)
    cy.contains("button", /patient/i).click();

    cy.get("form").submit();
    cy.wait("@loginRequest");

    // After stubbed login, auth context stores token; should land on patient dashboard
    cy.url().should("include", "/patient-dashboard");
  });

  it("unauthenticated user visiting /patient-dashboard is redirected to /login", () => {
    cy.visit("/patient-dashboard");
    cy.url().should("include", "/login");
  });
});
