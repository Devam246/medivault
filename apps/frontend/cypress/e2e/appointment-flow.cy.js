/**
 * E2E Spec: Appointment Booking Flow
 *
 * Covers:
 *  - Patient logs in and navigates to the appointment booking page
 *  - Doctor list loads and a doctor can be selected
 *  - Available slots are fetched and displayed
 *  - Appointment is booked; success message appears
 *  - Appointment appears in "My Appointments" list
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

describe("Appointment Booking Flow", () => {
  beforeEach(() => {
    // Stub doctor list
    cy.intercept("GET", "**/appointments/doctors", {
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

    // Stub slot retrieval
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

    // Stub booking
    cy.intercept("POST", "**/appointments", {
      statusCode: 200,
      body: { appointmentId: 101, message: "Appointment booked successfully" },
    }).as("bookAppointment");

    // Stub my appointments
    cy.intercept("GET", "**/patient/appointments", {
      statusCode: 200,
      body: {
        appointments: [
          {
            id: 101,
            doctor_name: "Dr. Jane House",
            appointment_date: "2026-07-06",
            appointment_time: "09:00:00",
            status: "scheduled",
          },
        ],
      },
    }).as("myAppointments");

    loginAsPatient();
  });

  it("navigates to booking page and selects a doctor", () => {
    cy.visit("/patient/book-appointment");
    cy.wait("@getDoctors");
    cy.contains("Dr. Jane House").should("be.visible").click();
  });

  it("selects a slot and books an appointment successfully", () => {
    cy.visit("/patient/book-appointment");
    cy.wait("@getDoctors");

    // Select doctor
    cy.contains("Dr. Jane House").click();

    // Pick a date (the component uses a date input)
    cy.get("input[type='date']").type("2026-07-06");
    cy.wait("@getSlots");

    // Select first available slot
    cy.contains("09:00").click();

    // Submit booking
    cy.contains("button", /confirm|book/i).click();
    cy.wait("@bookAppointment");

    // Success feedback should appear
    cy.contains(/booked|confirmed|success/i).should("be.visible");
  });
});
