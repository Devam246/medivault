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
    cy.intercept("GET", "**/admin/doctors**", {
      statusCode: 200,
      body: {
        doctors: [
          {
            id: 55,
            name: "Dr. Gregory House",
            email: "house@hospital.com",
            degree: "MD",
            regNumber: "REG-001",
          },
        ],
      },
    }).as("getPendingDoctors");

    cy.intercept("POST", "**/admin/doctors/55/approve", {
      statusCode: 200,
      body: { message: "Doctor approved successfully" },
    }).as("approveDoctor");

    cy.intercept("POST", "**/admin/doctors/55/reject", {
      statusCode: 200,
      body: { message: "Doctor rejected successfully" },
    }).as("rejectDoctor");

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
      .parents("[class*='justify-between']")
      .first()
      .contains("button", /approve/i)
      .click();

    cy.wait("@approveDoctor");
    cy.contains("Dr. Gregory House").should("not.exist");
  });

  it("admin can reject a pending doctor", () => {
    cy.visit("/admin");
    cy.wait("@getPendingDoctors");

    cy.contains("Dr. Gregory House")
      .parents("[class*='justify-between']")
      .first()
      .contains("button", /reject/i)
      .click();

    cy.wait("@rejectDoctor");
    cy.contains("Dr. Gregory House").should("not.exist");
  });

  it("admin dashboard displays system stats", () => {
    cy.visit("/admin");
    cy.wait("@getStats");
    cy.contains("Total Users").should("be.visible");
    cy.contains("12").should("be.visible");
  });
});
