/**
 * E2E Spec: Admin Doctor Approval Flow
 *
 * Covers:
 *  - Admin logs in and reaches the admin dashboard
 *  - Pending doctors list is displayed
 *  - Admin approves a pending doctor
 *  - Admin rejects a pending doctor
 *  - System stats are visible on the dashboard
 */

const ADMIN_TOKEN = "fake-admin-token";

function loginAsAdmin() {
  cy.intercept("POST", "**/auth/login", {
    statusCode: 200,
    body: { token: ADMIN_TOKEN, refreshToken: "fake-refresh", role: "admin" },
  }).as("login");

  cy.visit("/login");
  cy.get("input[type='email']").type("admin@medivault.com");
  cy.get("input[type='password']").type("adminpass123");
  cy.contains("button", /admin/i).click();
  cy.get("form").submit();
  cy.wait("@login");
}

describe("Admin Doctor Approval Flow", () => {
  beforeEach(() => {
    // Stub pending doctors
    cy.intercept("GET", "**/admin/doctors**", {
      statusCode: 200,
      body: {
        doctors: [
          {
            id: 55,
            name: "Dr. Gregory House",
            email: "house@hospital.com",
            specialty: "Diagnostics",
            reg_number: "REG-001",
          },
        ],
      },
    }).as("getPendingDoctors");

    // Stub approve
    cy.intercept("POST", "**/admin/doctors/55/approve", {
      statusCode: 200,
      body: { message: "Doctor approved successfully" },
    }).as("approveDoctor");

    // Stub reject
    cy.intercept("POST", "**/admin/doctors/55/reject", {
      statusCode: 200,
      body: { message: "Doctor rejected successfully" },
    }).as("rejectDoctor");

    // Stub system stats
    cy.intercept("GET", "**/admin/stats", {
      statusCode: 200,
      body: { users: 12, records: 45, appointments: 30 },
    }).as("getStats");

    loginAsAdmin();
  });

  it("admin dashboard shows pending doctors", () => {
    cy.visit("/admin");
    cy.wait("@getPendingDoctors");
    cy.contains("Dr. Gregory House").should("be.visible");
  });

  it("admin can approve a pending doctor", () => {
    cy.visit("/admin");
    cy.wait("@getPendingDoctors");

    cy.contains("Dr. Gregory House")
      .closest("[data-testid='doctor-row'], tr, li, div")
      .contains("button", /approve/i)
      .click();

    cy.wait("@approveDoctor");
    cy.contains(/approved successfully|approved/i).should("be.visible");
  });

  it("admin can reject a pending doctor", () => {
    cy.visit("/admin");
    cy.wait("@getPendingDoctors");

    cy.contains("Dr. Gregory House")
      .closest("[data-testid='doctor-row'], tr, li, div")
      .contains("button", /reject/i)
      .click();

    cy.wait("@rejectDoctor");
    cy.contains(/rejected successfully|rejected/i).should("be.visible");
  });

  it("admin dashboard displays system stats", () => {
    cy.visit("/admin");
    cy.wait("@getStats");

    // Stats values should be visible somewhere on the page
    cy.contains(/12|total users/i).should("be.visible");
  });
});
