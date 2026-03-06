"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";

const schema = z.object({
  name: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  venueId: z.string().min(1, "Select a venue"),
});
type FormData = z.infer<typeof schema>;

type Client = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  venueId: string;
  isRepeat: boolean;
  _count: { bookings: number };
};

export default function ClientsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const user = session?.user as { role?: string; venueId?: string | null } | undefined;

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", search],
    queryFn: () => fetch(`/api/clients?q=${encodeURIComponent(search)}`).then((r) => r.json()),
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["venues"],
    queryFn: () => fetch("/api/venues").then((r) => r.json()),
  });

  // ── Add form ──
  const addForm = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { venueId: user?.venueId ?? "" },
  });

  // ── Edit form ──
  const editForm = useForm<FormData>({ resolver: zodResolver(schema) });

  const createClient = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setAddOpen(false);
      addForm.reset();
      toast({ title: "Client added" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormData> }) => {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setEditClient(null);
      toast({ title: "Client updated" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setDeleteClient(null);
      toast({ title: "Client deleted" });
    },
    onError: (err: Error) => {
      setDeleteClient(null);
      toast({ title: err.message, variant: "destructive" });
    },
  });

  function openEdit(c: Client) {
    editForm.reset({
      name: c.name,
      phone: c.phone,
      email: c.email ?? "",
      address: c.address ?? "",
      venueId: c.venueId,
    });
    setEditClient(c);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Clients</h2>
          <p className="text-sm text-muted-foreground">{clients.length} clients</p>
        </div>

        {/* Add Client Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
            <ClientForm
              form={addForm}
              venues={venues}
              isPending={createClient.isPending}
              onSubmit={(d) => createClient.mutate(d)}
              submitLabel="Save Client"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search name, phone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Bookings</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                  <TableCell><div className="flex gap-1"><Skeleton className="h-7 w-7 rounded-md" /><Skeleton className="h-7 w-7 rounded-md" /></div></TableCell>
                </TableRow>
              ))
            ) : clients.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No clients found</TableCell></TableRow>
            ) : (
              clients.map((c: Client) => (
                <TableRow key={c.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                  </TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell>{c._count.bookings}</TableCell>
                  <TableCell>
                    {c.isRepeat && <Badge variant="secondary" className="text-xs">Repeat</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteClient(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editClient} onOpenChange={(o) => { if (!o) setEditClient(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          {editClient && (
            <ClientForm
              form={editForm}
              venues={venues}
              isPending={updateClient.isPending}
              onSubmit={(d) => updateClient.mutate({ id: editClient.id, data: d })}
              submitLabel="Update Client"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteClient} onOpenChange={(o) => { if (!o) setDeleteClient(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteClient?.name}</strong> will be permanently deleted. This cannot be undone.
              {deleteClient?._count.bookings > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This client has {deleteClient._count.bookings} booking(s) and cannot be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteClient && deleteClientMutation.mutate(deleteClient.id)}
              disabled={deleteClientMutation.isPending || (deleteClient?._count.bookings ?? 0) > 0}
            >
              {deleteClientMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientForm({
  form,
  venues,
  isPending,
  onSubmit,
  submitLabel,
}: {
  form: ReturnType<typeof useForm<FormData>>;
  venues: { id: string; name: string }[];
  isPending: boolean;
  onSubmit: (d: FormData) => void;
  submitLabel: string;
}) {
  const { register, handleSubmit, control, formState: { errors } } = form;
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label>Full Name *</Label>
        <Input placeholder="Ravi Kumar" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Phone *</Label>
          <Input placeholder="+91 98765 43210" {...register("phone")} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input placeholder="ravi@example.com" {...register("email")} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Address</Label>
        <Input placeholder="123 Street, City" {...register("address")} />
      </div>
      <div className="space-y-1">
        <Label>Venue *</Label>
        <Controller name="venueId" control={control} render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
            <SelectContent>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )} />
        {errors.venueId && <p className="text-xs text-destructive">{errors.venueId.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
