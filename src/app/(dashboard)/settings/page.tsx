"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AmenityCategory } from "@prisma/client";

const amenitySchema = z.object({
  name: z.string().min(1, "Required"),
  category: z.nativeEnum(AmenityCategory),
  defaultPrice: z.preprocess((v) => Number(v), z.number().min(0, "Required")),
  unit: z.string().min(1, "Required"),
  description: z.string().optional(),
});
type AmenityFormData = z.infer<typeof amenitySchema>;

const categoryOptions = Object.values(AmenityCategory).map((c: string) => ({
  value: c as string,
  label: (c as string).replace("_", " "),
}));

export default function SettingsPage() {
  const [amenityOpen, setAmenityOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ["amenity-templates"],
    queryFn: () => fetch("/api/amenity-templates").then((r) => r.json()),
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<AmenityFormData>({
    resolver: zodResolver(amenitySchema) as Resolver<AmenityFormData>,
    defaultValues: { unit: "per event" },
  });

  const createTemplate = useMutation({
    mutationFn: (data: AmenityFormData) =>
      fetch("/api/amenity-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amenity-templates"] });
      setAmenityOpen(false);
      reset();
      toast({ title: "Amenity template created" });
    },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage amenities, system preferences</p>
      </div>

      {/* Amenity Catalog */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Amenity Catalog</CardTitle>
          <Dialog open={amenityOpen} onOpenChange={setAmenityOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Add Amenity
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Amenity Template</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit((d: AmenityFormData) => createTemplate.mutate(d))} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label>Name *</Label>
                  <Input placeholder="DJ & Sound System" {...register("name")} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Category *</Label>
                    <Controller name="category" control={control} render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )} />
                    {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Unit *</Label>
                    <Input placeholder="per event / per plate / per hour" {...register("unit")} />
                    {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Default Price (₹) *</Label>
                  <Input type="number" step="0.01" placeholder="5000" {...register("defaultPrice")} />
                  {errors.defaultPrice && <p className="text-xs text-destructive">{errors.defaultPrice.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input placeholder="Brief description..." {...register("description")} />
                </div>
                <Button type="submit" className="w-full" disabled={createTemplate.isPending}>
                  {createTemplate.isPending ? "Creating..." : "Create Amenity"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Default Price</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No amenity templates yet</TableCell></TableRow>
              ) : (
                templates.map((t: { id: string; name: string; category: string; defaultPrice: number; unit: string }) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.category.replace("_", " ")}</TableCell>
                    <TableCell>₹{t.defaultPrice.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-muted-foreground">{t.unit}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
