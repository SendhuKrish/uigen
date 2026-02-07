import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { useAuth } from "../use-auth";
import * as actions from "@/actions";
import * as anonTracker from "@/lib/anon-work-tracker";
import * as getProjectsAction from "@/actions/get-projects";
import * as createProjectAction from "@/actions/create-project";
import { useRouter } from "next/navigation";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    cleanup();
  });

  describe("initial state", () => {
    test("returns correct initial values", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    test("successfully signs in and creates project from anonymous work", async () => {
      const mockAnonWork = {
        messages: [{ id: "1", role: "user", content: "Test message" }],
        fileSystemData: { "/test.js": { type: "file", content: "test" } },
      };

      const mockProject = {
        id: "project-123",
        name: "Test Project",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (actions.signIn as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (createProjectAction.createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      const authResult = await result.current.signIn("test@example.com", "password123");

      // Loading state should be false after completion
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(authResult.success).toBe(true);
      expect(actions.signIn).toHaveBeenCalledWith("test@example.com", "password123");
      expect(anonTracker.getAnonWorkData).toHaveBeenCalled();
      expect(createProjectAction.createProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: mockAnonWork.messages,
        data: mockAnonWork.fileSystemData,
      });
      expect(anonTracker.clearAnonWork).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/project-123");
    });

    test("successfully signs in and navigates to most recent project", async () => {
      const mockProjects = [
        { id: "project-1", name: "Project 1", createdAt: new Date(), updatedAt: new Date() },
        { id: "project-2", name: "Project 2", createdAt: new Date(), updatedAt: new Date() },
      ];

      (actions.signIn as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(null);
      (getProjectsAction.getProjects as any).mockResolvedValue(mockProjects);

      const { result } = renderHook(() => useAuth());

      const authResult = await result.current.signIn("test@example.com", "password123");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(authResult.success).toBe(true);
      expect(anonTracker.getAnonWorkData).toHaveBeenCalled();
      expect(getProjectsAction.getProjects).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/project-1");
      expect(createProjectAction.createProject).not.toHaveBeenCalled();
    });

    test("successfully signs in with anonymous work but no messages", async () => {
      const mockAnonWork = {
        messages: [],
        fileSystemData: {},
      };

      const mockProjects = [
        { id: "project-1", name: "Project 1", createdAt: new Date(), updatedAt: new Date() },
      ];

      (actions.signIn as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (getProjectsAction.getProjects as any).mockResolvedValue(mockProjects);

      const { result } = renderHook(() => useAuth());

      const authResult = await result.current.signIn("test@example.com", "password123");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(authResult.success).toBe(true);
      expect(createProjectAction.createProject).not.toHaveBeenCalled();
      expect(getProjectsAction.getProjects).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/project-1");
    });

    test("successfully signs in and creates new project when no projects exist", async () => {
      const mockProject = {
        id: "new-project-123",
        name: "New Design #12345",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (actions.signIn as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(null);
      (getProjectsAction.getProjects as any).mockResolvedValue([]);
      (createProjectAction.createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      const authResult = await result.current.signIn("test@example.com", "password123");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(authResult.success).toBe(true);
      expect(anonTracker.getAnonWorkData).toHaveBeenCalled();
      expect(getProjectsAction.getProjects).toHaveBeenCalled();
      expect(createProjectAction.createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockRouter.push).toHaveBeenCalledWith("/new-project-123");
    });

    test("handles sign in failure", async () => {
      const errorResult = { success: false, error: "Invalid credentials" };

      (actions.signIn as any).mockResolvedValue(errorResult);

      const { result } = renderHook(() => useAuth());

      const authResult = await result.current.signIn("test@example.com", "wrongpassword");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(authResult).toEqual(errorResult);
      expect(actions.signIn).toHaveBeenCalledWith("test@example.com", "wrongpassword");
      expect(anonTracker.getAnonWorkData).not.toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    test("ensures loading state is reset even on error", async () => {
      (actions.signIn as any).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      const promise = result.current.signIn("test@example.com", "password123");

      await expect(promise).rejects.toThrow("Network error");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("signUp", () => {
    test("successfully signs up and creates project from anonymous work", async () => {
      const mockAnonWork = {
        messages: [{ id: "1", role: "user", content: "Test message" }],
        fileSystemData: { "/test.js": { type: "file", content: "test" } },
      };

      const mockProject = {
        id: "project-456",
        name: "Test Project",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (actions.signUp as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (createProjectAction.createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      const authResult = await result.current.signUp("test@example.com", "password123");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(authResult.success).toBe(true);
      expect(actions.signUp).toHaveBeenCalledWith("test@example.com", "password123");
      expect(anonTracker.getAnonWorkData).toHaveBeenCalled();
      expect(createProjectAction.createProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: mockAnonWork.messages,
        data: mockAnonWork.fileSystemData,
      });
      expect(anonTracker.clearAnonWork).toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/project-456");
    });

    test("successfully signs up and creates new project when no projects exist", async () => {
      const mockProject = {
        id: "new-project-789",
        name: "New Design #54321",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (actions.signUp as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(null);
      (getProjectsAction.getProjects as any).mockResolvedValue([]);
      (createProjectAction.createProject as any).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useAuth());

      const authResult = await result.current.signUp("newuser@example.com", "securepassword");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(authResult.success).toBe(true);
      expect(actions.signUp).toHaveBeenCalledWith("newuser@example.com", "securepassword");
      expect(createProjectAction.createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(mockRouter.push).toHaveBeenCalledWith("/new-project-789");
    });

    test("handles sign up failure", async () => {
      const errorResult = { success: false, error: "Email already registered" };

      (actions.signUp as any).mockResolvedValue(errorResult);

      const { result } = renderHook(() => useAuth());

      const authResult = await result.current.signUp("existing@example.com", "password123");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(authResult).toEqual(errorResult);
      expect(actions.signUp).toHaveBeenCalledWith("existing@example.com", "password123");
      expect(anonTracker.getAnonWorkData).not.toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    test("ensures loading state is reset even on error", async () => {
      (actions.signUp as any).mockRejectedValue(new Error("Database error"));

      const { result } = renderHook(() => useAuth());

      const promise = result.current.signUp("test@example.com", "password123");

      await expect(promise).rejects.toThrow("Database error");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("edge cases", () => {
    test("handles concurrent signIn calls correctly", async () => {
      (actions.signIn as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(null);
      (getProjectsAction.getProjects as any).mockResolvedValue([
        { id: "project-1", name: "Project 1", createdAt: new Date(), updatedAt: new Date() },
      ]);

      const { result } = renderHook(() => useAuth());

      const promise1 = result.current.signIn("user1@example.com", "pass1");
      const promise2 = result.current.signIn("user2@example.com", "pass2");

      await Promise.all([promise1, promise2]);

      expect(actions.signIn).toHaveBeenCalledTimes(2);
    });

    test("handles getProjects throwing error", async () => {
      (actions.signIn as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(null);
      (getProjectsAction.getProjects as any).mockRejectedValue(new Error("Database error"));

      const { result } = renderHook(() => useAuth());

      await expect(result.current.signIn("test@example.com", "password123")).rejects.toThrow(
        "Database error"
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    test("handles createProject throwing error", async () => {
      const mockAnonWork = {
        messages: [{ id: "1", role: "user", content: "Test" }],
        fileSystemData: {},
      };

      (actions.signIn as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (createProjectAction.createProject as any).mockRejectedValue(new Error("Database full"));

      const { result } = renderHook(() => useAuth());

      await expect(result.current.signIn("test@example.com", "password123")).rejects.toThrow(
        "Database full"
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should not clear anon work if project creation fails
      expect(anonTracker.clearAnonWork).not.toHaveBeenCalled();
    });

    test("generates unique project names for new projects", async () => {
      (actions.signIn as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(null);
      (getProjectsAction.getProjects as any).mockResolvedValue([]);
      (createProjectAction.createProject as any).mockResolvedValue({
        id: "project-1",
        name: "Test",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test@example.com", "password123");

      expect(createProjectAction.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringMatching(/^New Design #\d+$/),
        })
      );

      const callArgs = (createProjectAction.createProject as any).mock.calls[0][0];
      const projectNumber = parseInt(callArgs.name.match(/\d+/)?.[0] || "0");
      expect(projectNumber).toBeGreaterThanOrEqual(0);
      expect(projectNumber).toBeLessThan(100000);
    });

    test("generates timestamp-based names for projects with anonymous work", async () => {
      const mockAnonWork = {
        messages: [{ id: "1", role: "user", content: "Test" }],
        fileSystemData: {},
      };

      (actions.signUp as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(mockAnonWork);
      (createProjectAction.createProject as any).mockResolvedValue({
        id: "project-1",
        name: "Test",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      await result.current.signUp("test@example.com", "password123");

      expect(createProjectAction.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: expect.stringContaining("Design from"),
        })
      );
    });

    test("handles router.push error gracefully", async () => {
      const mockRouterWithError = {
        ...mockRouter,
        push: vi.fn(() => {
          throw new Error("Navigation failed");
        }),
      };

      (useRouter as any).mockReturnValue(mockRouterWithError);
      (actions.signUp as any).mockResolvedValue({ success: true });
      (anonTracker.getAnonWorkData as any).mockReturnValue(null);
      (getProjectsAction.getProjects as any).mockResolvedValue([]);
      (createProjectAction.createProject as any).mockResolvedValue({
        id: "project-1",
        name: "Test",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      await expect(result.current.signUp("test@example.com", "password123")).rejects.toThrow(
        "Navigation failed"
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("loading state management", () => {
    test("isLoading is true during signIn execution", async () => {
      let resolveSignIn: any;
      (actions.signIn as any).mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      const promise = result.current.signIn("test@example.com", "password123");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      resolveSignIn({ success: false, error: "Test" });
      await promise;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    test("isLoading is true during signUp execution", async () => {
      let resolveSignUp: any;
      (actions.signUp as any).mockReturnValue(
        new Promise((resolve) => {
          resolveSignUp = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);

      const promise = result.current.signUp("test@example.com", "password123");

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      resolveSignUp({ success: false, error: "Test" });
      await promise;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    test("isLoading resets to false after multiple sequential calls", async () => {
      (actions.signIn as any).mockResolvedValue({ success: false, error: "Error" });

      const { result } = renderHook(() => useAuth());

      await result.current.signIn("test1@example.com", "pass1");
      expect(result.current.isLoading).toBe(false);

      await result.current.signIn("test2@example.com", "pass2");
      expect(result.current.isLoading).toBe(false);

      await result.current.signIn("test3@example.com", "pass3");
      expect(result.current.isLoading).toBe(false);
    });
  });
});
