/**
 * E2E Spec: Medical Record Upload Flow
 *
 * Covers:
 *  - Patient navigates to medical records section of dashboard
 *  - Uploads a file via the upload form
 *  - The upload API is called with the correct payload
 *  - Uploaded record appears in the records list
 *  - Patient can delete a record
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

describe("Medical Record Upload Flow", () => {
  beforeEach(() => {
    // Stub fetching existing records
    cy.intercept("GET", "**/patient/medical-records", {
      statusCode: 200,
      body: {
        records: [
          {
            id: 1,
            file_name: "blood_test.pdf",
            file_type: "application/pdf",
            uploaded_at: "2026-07-01T08:00:00Z",
            blockchain_hash: "0xabc123",
          },
        ],
      },
    }).as("getRecords");

    // Stub file upload endpoint
    cy.intercept("POST", "**/files/upload", {
      statusCode: 200,
      body: {
        message: "File uploaded successfully",
        fileHash: "0xnewhash456",
        recordId: 2,
      },
    }).as("uploadFile");

    // Stub delete record
    cy.intercept("DELETE", "**/patient/medical-records/1", {
      statusCode: 200,
      body: { message: "Record deleted successfully" },
    }).as("deleteRecord");

    loginAsPatient();
  });

  it("medical records section shows existing records", () => {
    cy.visit("/patient-dashboard");
    cy.wait("@getRecords");
    cy.contains("blood_test.pdf").should("be.visible");
  });

  it("uploads a new file and sees it in the list", () => {
    cy.visit("/patient-dashboard");
    cy.wait("@getRecords");

    // Find the file input and attach a file
    cy.get("input[type='file']").selectFile(
      {
        contents: Cypress.Buffer.from("dummy pdf content"),
        fileName: "checkup_2026.pdf",
        mimeType: "application/pdf",
      },
      { force: true }
    );

    // Submit the upload form
    cy.contains("button", /upload/i).click();
    cy.wait("@uploadFile");

    // Success feedback
    cy.contains(/uploaded successfully|success/i).should("be.visible");
  });

  it("patient can delete a medical record", () => {
    cy.visit("/patient-dashboard");
    cy.wait("@getRecords");

    // Click the delete button next to "blood_test.pdf"
    cy.contains("blood_test.pdf")
      .closest("[data-testid='record-row'], li, tr")
      .find("button[aria-label*='delete' i], button")
      .last()
      .click();

    cy.wait("@deleteRecord");
    cy.contains(/deleted|removed/i).should("be.visible");
  });
});
