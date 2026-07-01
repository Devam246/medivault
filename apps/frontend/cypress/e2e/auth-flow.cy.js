describe("Authentication Flow", () => {
  beforeEach(() => {
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

    cy.intercept("GET", "**/patient/profile", {
      statusCode: 200,
      body: { patient: { id: 1, name: "Alice Smith", email: "alice@example.com" } },
    }).as("getProfile");

    cy.intercept("GET", "**/patient/dashboard", {
      statusCode: 200,
      body: { upcomingAppointments: [], latestVitals: null },
    }).as("getDashboard");
  });

  it("landing page has login CTA", () => {
    cy.visit("/");
    cy.contains("Login").should("be.visible");
  });

  it("register page: fills and submits registration form", () => {
    cy.visit("/register");
    cy.get("input[name='name']").type("Alice Smith");
    cy.get("input[name='email']").type("alice@example.com");
    cy.get("input[name='password']").type("securepass123");

    cy.on("window:alert", () => true);
    cy.contains("button", /register as patient/i).click();

    cy.wait("@registerRequest").its("request.body").should("include", {
      email: "alice@example.com",
    });
  });

  it("login page: patient logs in and reaches patient dashboard", () => {
    cy.visit("/login");

    cy.get("input[type='email']").type("alice@example.com");
    cy.get("input[type='password']").type("securepass123");
    cy.contains("button", /patient/i).click();

    cy.get("form").submit();
    cy.wait("@loginRequest");
    cy.url().should("include", "/patient-dashboard");
  });

  it("unauthenticated user visiting /patient-dashboard is redirected to /login", () => {
    cy.visit("/patient-dashboard");
    cy.url().should("include", "/login");
  });
});
