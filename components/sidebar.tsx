"use client";

import {
  Package,
  LayoutDashboard,
  BoxesIcon,
  Settings,
  BarChart3,
  X,
  Upload,
  CheckCircle,
  FileText,
  FileCheck,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useProductStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export function Sidebar({ mobileMenuOpen, setMobileMenuOpen }: SidebarProps) {
  const { currentStage, setStage, products, workflowMode, setWorkflowMode } =
    useProductStore();
  const pathname = usePathname();
  const router = useRouter();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Steps 1 and 2 hold work that exists only in this browser session: uploaded
  // files and extracted data are not written anywhere until Step 2 creates the
  // cases. Step 3 is past that point, so it needs no warning.
  const hasUnsavedWork =
    workflowMode !== null && products.length > 0 && currentStage < 3;

  const goHome = () => {
    setWorkflowMode(null);
    setStage(1);
    setMobileMenuOpen(false);
    if (pathname !== "/") router.push("/");
  };

  const handleLogoClick = () => {
    if (hasUnsavedWork) {
      setShowLeaveDialog(true);
      return;
    }
    goHome();
  };

  return (
    <>
      {/* Slim Sidebar */}
      <aside className="w-20 bg-card border-r hidden md:flex flex-col items-center py-4 gap-4">
        <button
          type="button"
          onClick={handleLogoClick}
          title="Back to dashboard"
          aria-label="Back to dashboard"
          className="w-12 h-12 flex items-center justify-center mb-4 rounded-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src="/images/hkscss-logo.svg"
            alt="HKCSS Logo"
            width={120}
            height={80}
            className="object-contain"
          />
        </button>
        <nav className="flex flex-col gap-3">
          <Link
            href="/"
            title="Dashboard"
            aria-current={pathname === "/" ? "page" : undefined}
            className={`p-3 rounded-lg transition-colors ${
              pathname === "/"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-foreground"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
          </Link>

          <Link
            href="/staff"
            title="Staff Directory"
            aria-current={pathname === "/staff" ? "page" : undefined}
            className={`p-3 rounded-lg transition-colors ${
              pathname === "/staff"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-foreground"
            }`}
          >
            <Users className="w-5 h-5" />
          </Link>

          {/* <Link
            href="/cases"
            title="All Cases"
            className={`p-3 rounded-lg transition-colors ${
              pathname === "/cases" 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-accent text-foreground"
            }`}
          >
            <FileText className="w-5 h-5" />
          </Link> */}
          
          {/* Quick Navigation */}
          {/* <div className="border-t pt-3 mt-3 flex flex-col gap-3">
            <button
              title="Extraction (Step 1)"
              onClick={() => setStage(1)}
              className={`p-3 rounded-lg transition-colors ${
                currentStage === 1
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              <Upload className="w-5 h-5" />
            </button>
            <Link
              href="/eg-upload"
              title="EG Upload & Replace"
              aria-current={pathname === "/eg-upload" ? "page" : undefined}
              className={`p-3 rounded-lg transition-colors ${
                pathname === "/eg-upload"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              <FileCheck className="w-5 h-5" />
            </Link>
            <button
              title="Justification (Step 3)"
              onClick={() => setStage(3)}
              className={`p-3 rounded-lg transition-colors ${
                currentStage === 3
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              <CheckCircle className="w-5 h-5" />
            </button>
          </div> */}
          {/* <button
            title="Products"
            className="p-3 rounded-lg hover:bg-accent transition-colors text-foreground"
          >
            <BoxesIcon className="w-5 h-5" />
          </button>
          <button
            title="Settings"
            className="p-3 rounded-lg hover:bg-accent transition-colors text-foreground"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            title="Reports"
            className="p-3 rounded-lg hover:bg-accent transition-colors text-foreground"
          >
            <BarChart3 className="w-5 h-5" />
          </button> */}
        </nav>
      </aside>

      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside className="w-64 bg-card h-full border-r">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Menu</h2>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-4 space-y-2">
              <Link
                href="/"
                aria-current={pathname === "/" ? "page" : undefined}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium ${
                  pathname === "/"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>

              <Link
                href="/staff"
                aria-current={pathname === "/staff" ? "page" : undefined}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium ${
                  pathname === "/staff"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Users className="w-4 h-4" />
                Staff Directory
              </Link>

              {/* <Link
                href="/cases"
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium ${
                  pathname === "/cases"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <FileText className="w-4 h-4" />
                All Cases
              </Link> */}
              
              {/* Quick Navigation Section */}
              {/* <div className="pt-4 mt-4 border-t space-y-2">
                <p className="px-4 text-xs font-semibold text-muted-foreground mb-2">
                  QUICK ACCESS
                </p>
                <button
                  onClick={() => {
                    setStage(1);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium ${
                    currentStage === 1
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Extraction (Step 1)
                </button>
                <Link
                  href="/eg-upload"
                  aria-current={pathname === "/eg-upload" ? "page" : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium ${
                    pathname === "/eg-upload"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <FileCheck className="w-4 h-4" />
                  EG Upload & Replace
                </Link>
                <button
                  onClick={() => {
                    setStage(3);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium ${
                    currentStage === 3
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Justification (Step 3)
                </button>
              </div> */}
              
              {/* <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent text-sm font-medium text-foreground">
                <BoxesIcon className="w-4 h-4" />
                Products
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent text-sm font-medium text-foreground">
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent text-sm font-medium text-foreground">
                <BarChart3 className="w-4 h-4" />
                Reports
              </button> */}
            </nav>
          </aside>
        </div>
      )}

      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this workflow?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              You have {products.length} product
              {products.length === 1 ? "" : "s"} in progress
              {currentStage === 1
                ? " with uploaded documents."
                : " that have not been saved as cases yet."}
            </p>
            <p>
              Nothing here is stored on the server until you press{" "}
              <strong className="text-foreground">Save Cases</strong> in Step 2.
              Until then it lives only in this browser, so refreshing or closing
              the tab will lose it.
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Stay in workflow
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowLeaveDialog(false);
                goHome();
              }}
            >
              Go to dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
