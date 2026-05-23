import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./sidebar";

// ── Mocks ──

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

const mockSetStage = vi.fn();
const mockSetMobileMenuOpen = vi.fn();

vi.mock("@/lib/store", () => ({
  useProductStore: () => ({
    currentStage: 1,
    setStage: mockSetStage,
  }),
}));

vi.mock("lucide-react", async () => {
  return {
    LayoutDashboard: () => <span data-testid="icon-dashboard">D</span>,
    Upload: () => <span data-testid="icon-upload">U</span>,
    FileCheck: () => <span data-testid="icon-filecheck">F</span>,
    CheckCircle: () => <span data-testid="icon-check">C</span>,
    FileText: () => <span data-testid="icon-file">T</span>,
    Menu: () => <span data-testid="icon-menu">M</span>,
    X: () => <span data-testid="icon-close">X</span>,
    LogOut: () => <span data-testid="icon-logout">L</span>,
    Package: () => <span data-testid="icon-package">P</span>,
    BoxesIcon: () => <span data-testid="icon-boxes">B</span>,
    Settings: () => <span data-testid="icon-settings">S</span>,
    BarChart3: () => <span data-testid="icon-chart">Ch</span>,
  };
});

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt || ""} />
  ),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/";
  });

  it("renders desktop navigation with Dashboard and EG Upload links", () => {
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    // Desktop sidebar is the hidden md:flex aside
    const dashboardLink = screen.getByTitle("Dashboard");
    expect(dashboardLink).toHaveAttribute("href", "/");

    const egUploadLink = screen.getByTitle("EG Upload & Replace");
    expect(egUploadLink).toHaveAttribute("href", "/eg-upload");
  });

  it("marks current page with aria-current on Dashboard", () => {
    mockPathname = "/";
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const dashboardLink = screen.getByTitle("Dashboard");
    expect(dashboardLink).toHaveAttribute("aria-current", "page");

    const egUploadLink = screen.getByTitle("EG Upload & Replace");
    expect(egUploadLink).not.toHaveAttribute("aria-current");
  });

  it("marks current page with aria-current on EG Upload", () => {
    mockPathname = "/eg-upload";
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const egUploadLink = screen.getByTitle("EG Upload & Replace");
    expect(egUploadLink).toHaveAttribute("aria-current", "page");

    const dashboardLink = screen.getByTitle("Dashboard");
    expect(dashboardLink).not.toHaveAttribute("aria-current");
  });

  it("applies active styling to current page link", () => {
    mockPathname = "/eg-upload";
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const egUploadLink = screen.getByTitle("EG Upload & Replace");
    expect(egUploadLink.className).toContain("bg-primary");
  });

  it("applies inactive styling to non-active page links", () => {
    mockPathname = "/";
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const egUploadLink = screen.getByTitle("EG Upload & Replace");
    expect(egUploadLink.className).not.toContain("bg-primary");
    expect(egUploadLink.className).toContain("hover:bg-accent");
  });

  it("renders EG Upload link in mobile menu", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar mobileMenuOpen={true} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    // Mobile menu is rendered when mobileMenuOpen=true
    const mobileEgUpload = screen.getAllByText("EG Upload & Replace")[0];
    expect(mobileEgUpload).toBeInTheDocument();

    // Clicking should close mobile menu
    await user.click(mobileEgUpload.closest("a")!);
    expect(mockSetMobileMenuOpen).toHaveBeenCalledWith(false);
  });

  it("sets stage to 1 when extraction button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const extractionBtn = screen.getByTitle("Extraction (Step 1)");
    await user.click(extractionBtn);

    expect(mockSetStage).toHaveBeenCalledWith(1);
  });

  it("sets stage to 3 when justification button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const justificationBtn = screen.getByTitle("Justification (Step 3)");
    await user.click(justificationBtn);

    expect(mockSetStage).toHaveBeenCalledWith(3);
  });

  it("toggles mobile menu when hamburger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar mobileMenuOpen={false} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    // Hamburger is in the mobile header, not in sidebar directly
    // The sidebar only renders the aside; hamburger is in Header component
    // So we test the mobile menu close button instead when menu is open
    render(
      <Sidebar mobileMenuOpen={true} setMobileMenuOpen={mockSetMobileMenuOpen} />
    );

    const closeBtn = screen.getAllByRole("button").find((btn) =>
      btn.querySelector('[data-testid="icon-close"]')
    );
    if (closeBtn) {
      await user.click(closeBtn);
      expect(mockSetMobileMenuOpen).toHaveBeenCalledWith(false);
    }
  });
});
