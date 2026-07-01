const PATIENT_TOKEN = "fake-patient-token";

function stubPatientDashboard() {
  cy.intercept("GET", "**/patient/profile", {
    statusCode: 200,
    body: { patient: { id: 1, name: "Alice Smith", email: "alice@example.com" } },
  }).as("getProfile");

  cy.intercept("GET", "**/patient/dashboard", {
    statusCode: 200,
    body: { upcomingAppointments: [], latestVitals: null },
  }).as("getDashboard");
}

function loginAsPatient() {
  cy.intercept("POST", "**/auth/login", {
    statusCode: 200,
    body: { token: PATIENT_TOKEN, refreshToken: "fake-refresh", role: "patient" },
  }).as("login");

  cy.visit("/login");
  cy.get("input[type='email']").type("alice@example.com");
  cy.get("input[type='password']").type("securepass123");
  cy.contains("button", /patient/i).click();
  cy.get("form").submit();
  cy.wait("@login");
}

describe("Easy Access Flow", () => {
  beforeEach(() => {
    stubPatientDashboard();

    cy.intercept("GET", "**/patient/appointments", {
      statusCode: 200,
      body: {
        appointments: [
          {
            id: 101,
            doctor_name: "Dr. Jane House",
            specialty: "General Medicine",
            appointment_date: "2026-07-10",
            appointment_time: "10:00:00",
            status: "confirmed",
          },
        ],
      },
    }).as("myAppointments");

    cy.intercept("POST", "**/appointments/101/easy-access", {
      statusCode: 200,
      body: { message: "Access granted for 30 minutes", expiresAt: "2026-07-10T11:00:00Z" },
    }).as("grantEasyAccess");

    loginAsPatient();
  });

  it("patient can grant easy access to their appointment", () => {
    cy.visit("/patient-dashboard");
    cy.wait("@getProfile");
    cy.contains("button", /my appointments/i).click();
    cy.wait("@myAppointments");

    cy.contains("Dr. Jane House")
      .parents("[class*='rounded-2xl']")
      .first()
      .contains("button", /grant access/i)
      .click();

    cy.wait("@grantEasyAccess");
    cy.contains(/granted until/i).should("be.visible");
  });

  it("easy access display shows expiry information", () => {
    cy.visit("/patient-dashboard");
    cy.wait("@getProfile");
    cy.contains("button", /my appointments/i).click();
    cy.wait("@myAppointments");

    cy.contains("button", /grant access/i).click();
    cy.wait("@grantEasyAccess");
    cy.contains(/granted until|2026/i).should("be.visible");
  });
});
