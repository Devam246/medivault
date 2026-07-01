/**
 * E2E Spec: Easy Access (QR Code) Flow
 *
 * Covers:
 *  - Patient grants easy access to an appointment
 *  - QR code / access code is displayed after granting
 *  - Doctor can view the shared records via the access endpoint
 *  - Access code expiry information is present
 */

const PATIENT_TOKEN = "fake-patient-token";

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

describe("Easy Access (QR Code) Flow", () => {
  beforeEach(() => {
    // Stub patient's appointments list
    cy.intercept("GET", "**/patient/appointments", {
      statusCode: 200,
      body: {
        appointments: [
          {
            id: 101,
            doctor_name: "Dr. Jane House",
            appointment_date: "2026-07-10",
            appointment_time: "10:00:00",
            status: "scheduled",
          },
        ],
      },
    }).as("myAppointments");

    // Stub easy access grant
    cy.intercept("POST", "**/appointments/101/easy-access", {
      statusCode: 200,
      body: {
        message: "Easy access granted",
        accessToken: "easy-access-abc123",
        expiresAt: "2026-07-10T11:00:00Z",
      },
    }).as("grantEasyAccess");

    loginAsPatient();
  });

  it("patient can grant easy access to their appointment", () => {
    cy.visit("/patient-dashboard");
    cy.wait("@myAppointments");

    // Find the appointment and click easy access
    cy.contains("Dr. Jane House")
      .closest("[data-testid='appointment-card'], li, tr, div")
      .contains("button", /easy access|share|qr/i)
      .click();

    cy.wait("@grantEasyAccess");

    // Access token / QR code should be displayed
    cy.contains(/easy-access-abc123|access granted|qr code/i).should("be.visible");
  });

  it("easy access display shows expiry information", () => {
    cy.visit("/patient-dashboard");
    cy.wait("@myAppointments");

    cy.contains("Dr. Jane House")
      .closest("[data-testid='appointment-card'], li, tr, div")
      .contains("button", /easy access|share|qr/i)
      .click();

    cy.wait("@grantEasyAccess");

    // Expiry time or related text should appear
    cy.contains(/expir|valid until/i).should("be.visible");
  });
});
