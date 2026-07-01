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

describe("Medical Record Upload Flow", () => {
  beforeEach(() => {
    stubPatientDashboard();

    cy.intercept("GET", "**/patient/medical-records", {
      statusCode: 200,
      body: {
        records: [
          {
            id: 1,
            title: "Blood Test Report",
            type: "Lab Report",
            file_name: "blood_test.pdf",
            file_path: "/uploads/blood_test.pdf",
            record_date: "2026-07-01",
          },
        ],
      },
    }).as("getRecords");

    cy.intercept("POST", "**/files/upload", {
      statusCode: 200,
      body: { message: "File uploaded successfully", fileHash: "0xnewhash456", recordId: 2 },
    }).as("uploadFile");

    cy.intercept("DELETE", "**/patient/medical-records/1", {
      statusCode: 200,
      body: { message: "Record deleted successfully" },
    }).as("deleteRecord");

    cy.on("window:confirm", () => true);
    cy.on("window:alert", () => true);
    loginAsPatient();
  });

  it("medical records section shows existing records", () => {
    cy.visit("/patient-dashboard");
    cy.wait("@getProfile");
    cy.contains("button", /medical records/i).click();
    cy.wait("@getRecords");
    cy.contains("Blood Test Report").should("be.visible");
  });

  it("uploads a new file", () => {
    cy.visit("/patient-dashboard");
    cy.wait("@getProfile");
    cy.contains("button", /medical records/i).click();
    cy.wait("@getRecords");

    cy.contains("button", /upload record/i).click();
    cy.get("input[placeholder='e.g., Blood Test Report']").type("Checkup 2026");
    cy.get("select").select("Lab Report");
    cy.get("input[type='file']").selectFile(
      { contents: Cypress.Buffer.from("dummy pdf content"), fileName: "checkup_2026.pdf", mimeType: "application/pdf" },
      { force: true }
    );
    cy.contains("button", /^Upload$/).click();
    cy.wait("@uploadFile");
  });

  it("patient can delete a medical record", () => {
    cy.visit("/patient-dashboard");
    cy.wait("@getProfile");
    cy.contains("button", /medical records/i).click();
    cy.wait("@getRecords");

    cy.contains("Blood Test Report")
      .parents("[class*='justify-between']")
      .first()
      .find("button[aria-label^='Delete']")
      .click();

    cy.wait("@deleteRecord");
  });
});
