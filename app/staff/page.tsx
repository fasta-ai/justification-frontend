"use client";

import { useMemo, useState } from "react";
import { Users, Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ProtectedRoute } from "@/components/protected-route";
import { useStaff, type Staff, type StaffInput } from "@/hooks/use-staff";
import { useToast } from "@/hooks/use-toast";

interface EditingState {
  mode: "create" | "edit";
  data: StaffInput & { id?: string };
}

const emptyForm: StaffInput = {
  name: "",
  position: "",
  phone: "",
  email: "",
};

export default function StaffPage() {
  const { staff, isLoading, error, create, update, remove, refetch } =
    useStaff();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [deleting, setDeleting] = useState<Staff | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) =>
      [s.name, s.position, s.phone, s.email]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [staff, searchQuery]);

  function openCreate() {
    setEditing({ mode: "create", data: { ...emptyForm } });
  }

  function openEdit(s: Staff) {
    setEditing({
      mode: "edit",
      data: {
        id: s.id,
        name: s.name || "",
        position: s.position || "",
        phone: s.phone || "",
        email: s.email || "",
      },
    });
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.data.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      if (editing.mode === "create") {
        await create({
          name: editing.data.name.trim(),
          position: editing.data.position?.trim() || "",
          phone: editing.data.phone?.trim() || "",
          email: editing.data.email?.trim() || "",
        });
        toast({ title: "Staff added" });
      } else if (editing.data.id) {
        await update(editing.data.id, {
          name: editing.data.name.trim(),
          position: editing.data.position?.trim() || "",
          phone: editing.data.phone?.trim() || "",
          email: editing.data.email?.trim() || "",
        });
        toast({ title: "Staff updated" });
      }
      setEditing(null);
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      await remove(deleting.id);
      toast({ title: "Staff removed" });
      setDeleting(null);
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex">
        <Sidebar
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        <div className="flex-1 flex flex-col">
          <Header
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
            products={[]}
            resetStore={() => {}}
          />

          <main className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold">Staff Directory</h1>
                  <p className="text-sm text-muted-foreground">
                    Manage the roster used by the EG form Staff1 / Staff2
                    pickers.
                  </p>
                </div>
              </div>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Add staff
              </Button>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {filtered.length} of {staff.length} staff
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Sorted by name.
                    </CardDescription>
                  </div>
                  <div className="relative w-72">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, position, phone, email…"
                      className="pl-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {error ? (
                  <div className="text-sm text-destructive py-6">
                    {error}{" "}
                    <button
                      className="underline"
                      onClick={() => refetch()}
                      type="button"
                    >
                      Retry
                    </button>
                  </div>
                ) : isLoading && staff.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading staff…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-10 text-center">
                    No staff found.
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Name</TableHead>
                          <TableHead className="font-semibold">
                            Position
                          </TableHead>
                          <TableHead className="font-semibold">Phone</TableHead>
                          <TableHead className="font-semibold">Email</TableHead>
                          <TableHead className="w-24 text-right font-semibold">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">
                              {s.name}
                            </TableCell>
                            <TableCell className="text-sm">
                              {s.position || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {s.phone || "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {s.email || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEdit(s)}
                                  title="Edit staff"
                                  className="h-8 w-8"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleting(s)}
                                  title="Delete staff"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => (open ? null : setEditing(null))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing?.mode === "create" ? "Add staff" : "Edit staff"}
            </DialogTitle>
            <DialogDescription>
              The name / position feeds Staff1 / Staff2 and the phone / email
              feeds Staff1_Info / Staff2_Info.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="staff-name">Name</Label>
                <Input
                  id="staff-name"
                  value={editing.data.name}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      data: { ...editing.data, name: e.target.value },
                    })
                  }
                  placeholder="Argus Chan"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="staff-position">Position</Label>
                <Input
                  id="staff-position"
                  value={editing.data.position || ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      data: { ...editing.data, position: e.target.value },
                    })
                  }
                  placeholder="Manager/ITA"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input
                  id="staff-phone"
                  value={editing.data.phone || ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      data: { ...editing.data, phone: e.target.value },
                    })
                  }
                  placeholder="3705 5357"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={editing.data.email || ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      data: { ...editing.data, email: e.target.value },
                    })
                  }
                  placeholder="argus.chan@hkcss.org.hk"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => (open ? null : setDeleting(null))}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete staff</DialogTitle>
            <DialogDescription>
              Remove <strong>{deleting?.name}</strong> from the directory? This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}
