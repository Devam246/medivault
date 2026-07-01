import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, test, expect, beforeEach } from "vitest";
import RequireAuth from "../../src/components/auth/RequireAuth";
import { useAuth } from "../../src/context/AuthContext";
import "@testing-library/jest-dom";

// Mock AuthContext useAuth hook
vi.mock("../../src/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// Mock react-router-dom Navigate component
vi.mock("react-router-dom", () => ({
  Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />,
}));

describe("RequireAuth Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders null while auth context is loading", () => {
    useAuth.mockReturnValue({
      token: null,
      role: null,
      loading: true,
    });

    const { container } = render(
      <RequireAuth>
        <div data-testid="child">Protected Content</div>
      </RequireAuth>
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("child")).toBeNull();
  });

  test("redirects to /login if user is not authenticated", () => {
    useAuth.mockReturnValue({
      token: null,
      role: null,
      loading: false,
    });

    render(
      <RequireAuth>
        <div data-testid="child">Protected Content</div>
      </RequireAuth>
    );

    const navigate = screen.getByTestId("navigate");
    expect(navigate).toBeInTheDocument();
    expect(navigate.getAttribute("data-to")).toBe("/login");
    expect(screen.queryByTestId("child")).toBeNull();
  });

  test("redirects patient to /patient-dashboard if they try to access a doctor page", () => {
    useAuth.mockReturnValue({
      token: "valid-token",
      role: "patient",
      loading: false,
    });

    render(
      <RequireAuth role="doctor">
        <div data-testid="child">Protected Content</div>
      </RequireAuth>
    );

    const navigate = screen.getByTestId("navigate");
    expect(navigate).toBeInTheDocument();
    expect(navigate.getAttribute("data-to")).toBe("/patient-dashboard");
    expect(screen.queryByTestId("child")).toBeNull();
  });

  test("redirects doctor to /doctor if they try to access a patient page", () => {
    useAuth.mockReturnValue({
      token: "valid-token",
      role: "doctor",
      loading: false,
    });

    render(
      <RequireAuth role="patient">
        <div data-testid="child">Protected Content</div>
      </RequireAuth>
    );

    const navigate = screen.getByTestId("navigate");
    expect(navigate).toBeInTheDocument();
    expect(navigate.getAttribute("data-to")).toBe("/doctor");
  });

  test("renders children if user has the correct required role", () => {
    useAuth.mockReturnValue({
      token: "valid-token",
      role: "patient",
      loading: false,
    });

    render(
      <RequireAuth role="patient">
        <div data-testid="child">Protected Content</div>
      </RequireAuth>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByTestId("navigate")).toBeNull();
  });
});
