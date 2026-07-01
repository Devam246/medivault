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

describe("Appointment Booking Flow", () => {
  beforeEach(() => {
    cy.intercept("GET", "**/doctors/search**", {
      statusCode: 200,
      body: {
        doctors: [
          {
            id: 42,
            name: "Dr. Jane House",
            specialty: "General Medicine",
            is_verified: 1,
            available_days: "Mon,Tue,Wed,Thu,Fri",
          },
        ],
      },
    }).as("getDoctors");

    cy.intercept("GET", "**/appointments/patient", {
      statusCode: 200,
      body: { appointments: [] },
    }).as("myAppointments");

    cy.intercept("GET", "**/appointments/doctor/42/slots**", {
      statusCode: 200,
      body: {
        date: "2026-07-06",
        slots: [
          { time: "09:00:00", available: true },
          { time: "10:00:00", available: true },
          { time: "11:00:00", available: false },
        ],
      },
    }).as("getSlots");

    cy.intercept("POST", "**/appointments", {
      statusCode: 200,
      body: { appointmentId: 101, message: "Appointment requested successfully" },
    }).as("bookAppointment");

    loginAsPatient();
  });

  it("navigates to booking page and selects a doctor", () => {
    cy.visit("/patient/book-appointment");
    cy.wait("@getDoctors");
    cy.contains("Dr. Jane House").should("be.visible");
    cy.contains("button", "Select").click();
    cy.contains("Dr. Jane House").should("be.visible");
  });

  it("selects a slot and books an appointment successfully", () => {
    cy.visit("/patient/book-appointment");
    cy.wait("@getDoctors");

    cy.contains("button", "Select").click();
    cy.get("input[type='date']").type("2026-07-06");
    cy.wait("@getSlots");

    cy.contains("9:00 AM").click();
    cy.contains("button", /confirm appointment/i).click();
    cy.wait("@bookAppointment");

    cy.contains(/appointment requested/i).should("be.visible");
  });
});
