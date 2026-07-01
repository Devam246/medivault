import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, test, expect, beforeEach } from "vitest";
import PatientHealthChat from "../../src/components/patient/PatientHealthChat";
import "@testing-library/jest-dom";

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock scrollIntoView since jsdom doesn't support layout/scrolling methods
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe("PatientHealthChat Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders initial greeting message", () => {
    render(<PatientHealthChat token="mock-token" />);
    expect(screen.getByText(/Ask questions about your MediVault history/i)).toBeInTheDocument();
  });

  test("returns canned response immediately without network call for matched queries", async () => {
    const { container } = render(<PatientHealthChat token="mock-token" />);

    const input = screen.getByPlaceholderText(/prescribed/i);
    const form = container.querySelector("form");

    // Type a canned response query
    fireEvent.change(input, { target: { value: "is this sugar level safe?" } });
    fireEvent.submit(form);

    // Should display patient's message
    expect(screen.getByText("is this sugar level safe?")).toBeInTheDocument();

    // Should display canned response immediately without fetch being called
    await waitFor(() => {
      expect(screen.getByText(/generally a fasting blood sugar under 100/i)).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("makes RAG chat API call for custom queries and displays response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        answer: "This is a custom RAG response from backend.",
      }),
    });

    const { container } = render(<PatientHealthChat token="mock-token" />);

    const input = screen.getByPlaceholderText(/prescribed/i);
    const form = container.querySelector("form");

    // Type a custom query
    fireEvent.change(input, { target: { value: "What is my latest blood report date?" } });
    fireEvent.submit(form);

    expect(screen.getByText("What is my latest blood report date?")).toBeInTheDocument();

    // Verify API is hit with correct payload
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/patient/rag/chat"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer mock-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ message: "What is my latest blood report date?", top_k: 5 }),
      })
    );

    // Verify response renders
    await waitFor(() => {
      expect(screen.getByText("This is a custom RAG response from backend.")).toBeInTheDocument();
    });
  });

  test("displays error message if the backend request fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        message: "Internal server error occurred.",
      }),
    });

    const { container } = render(<PatientHealthChat token="mock-token" />);

    const input = screen.getByPlaceholderText(/prescribed/i);
    const form = container.querySelector("form");

    fireEvent.change(input, { target: { value: "Trigger error query" } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Internal server error occurred/i)).toBeInTheDocument();
    });
  });
});
