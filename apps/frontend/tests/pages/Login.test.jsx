import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, test, expect, beforeEach } from "vitest";
import Login from "../../src/pages/auth/Login";

const mockNavigate = vi.fn();
const mockLogin = vi.fn();

// Mock react-router-dom Link and useNavigate
vi.mock("react-router-dom", () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
}));

// Mock AuthContext
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Login Page Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders all form elements and updates input values", () => {
    render(<Login />);

    const emailInput = screen.getByPlaceholderText(/Enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    expect(emailInput.value).toBe("test@example.com");
    expect(passwordInput.value).toBe("password123");
  });

  test("updates role selection", () => {
    render(<Login />);

    const patientBtn = screen.getByRole("button", { name: /patient/i });
    const doctorBtn = screen.getByRole("button", { name: /doctor/i });
    const adminBtn = screen.getByRole("button", { name: /admin/i });

    // Select doctor
    fireEvent.click(doctorBtn);
    expect(doctorBtn.className).toContain("border-sky-500");

    // Select admin
    fireEvent.click(adminBtn);
    expect(adminBtn.className).toContain("border-sky-500");
    expect(doctorBtn.className).not.toContain("border-sky-500");
  });

  test("submits successfully and calls login context and navigates based on role", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: "mock-access-token",
        refreshToken: "mock-refresh-token",
        role: "patient",
      }),
    });

    render(<Login />);

    const emailInput = screen.getByPlaceholderText(/Enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
    const loginButton = screen.getByRole("button", { name: "Login" });

    fireEvent.change(emailInput, { target: { value: "patient@test.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(loginButton);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:4000/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "patient@test.com", password: "password123", role: "patient" }),
      })
    );

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("mock-access-token", "mock-refresh-token", "patient");
      expect(mockNavigate).toHaveBeenCalledWith("/patient-dashboard");
    });
  });

  test("handles error if login fails", async () => {
    const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: "Invalid credentials",
      }),
    });

    render(<Login />);

    const emailInput = screen.getByPlaceholderText(/Enter your email/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
    const loginButton = screen.getByRole("button", { name: "Login" });

    fireEvent.change(emailInput, { target: { value: "wrong@test.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpass" } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith("Invalid credentials");
      expect(mockLogin).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    alertMock.mockRestore();
  });
});
