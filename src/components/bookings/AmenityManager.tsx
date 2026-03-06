"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface Amenity {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  amenityTemplateId: string;
  amenityTemplate: { category: string; unit: string };
}

interface AmenityTemplate {
  id: string;
  name: string;
  category: string;
  defaultPrice: number;
  unit: string;
  isActive?: boolean;
}

const categoryColors: Record<string, string> = {
  DECORATION: "bg-pink-100 text-pink-700",
  AUDIO_VISUAL: "bg-blue-100 text-blue-700",
  CATERING: "bg-orange-100 text-orange-700",
  ENTERTAINMENT: "bg-purple-100 text-purple-700",
  FURNITURE: "bg-gray-100 text-gray-700",
  PHOTOGRAPHY: "bg-green-100 text-green-700",
  OTHER: "bg-yellow-100 text-yellow-700",
};

export function AmenityManager({
  bookingId,
  bookingStatus,
}: {
  bookingId: string;
  bookingStatus: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const { toast } = useToast();
  const qc = useQueryClient();

  const canEdit = !["COMPLETED", "CANCELLED"].includes(bookingStatus);

  // Own query for amenities — direct, not via parent booking
  const { data: amenities = [], isLoading: loadingAmenities } = useQuery<Amenity[]>({
    queryKey: ["amenities", bookingId],
    queryFn: async () => {
      const r = await fetch(`/api/bookings/${bookingId}/amenities`);
      if (!r.ok) throw new Error("Failed to fetch amenities");
      return r.json();
    },
  });

  const { data: templates = [] } = useQuery<AmenityTemplate[]>({
    queryKey: ["amenity-templates"],
    queryFn: () => fetch("/api/amenity-templates").then((r) => r.json()),
    enabled: open,
  });

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const addAmenity = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/bookings/${bookingId}/amenities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amenityTemplateId: selectedTemplateId, quantity, unitPrice }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amenities", bookingId] });
      qc.invalidateQueries({ queryKey: ["booking", bookingId] });
      setOpen(false);
      setSelectedTemplateId("");
      setQuantity(1);
      setUnitPrice(0);
      toast({ title: "Amenity added" });
    },
    onError: () => toast({ title: "Failed to add amenity", variant: "destructive" }),
  });

  const removeAmenity = useMutation({
    mutationFn: async (amenityId: string) => {
      const r = await fetch(`/api/bookings/${bookingId}/amenities`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amenityId }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? "Failed");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amenities", bookingId] });
      qc.invalidateQueries({ queryKey: ["booking", bookingId] });
      toast({ title: "Amenity removed" });
    },
    onError: () => toast({ title: "Failed to remove amenity", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {amenities.length} amenit{amenities.length !== 1 ? "ies" : "y"} added
        </p>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Add Amenity
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Amenity to Booking</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label>Amenity</Label>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={(id) => {
                      setSelectedTemplateId(id);
                      const t = templates.find((x) => x.id === id);
                      if (t) setUnitPrice(t.defaultPrice);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select amenity" /></SelectTrigger>
                    <SelectContent>
                      {templates.filter((t) => t.isActive ?? true).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} — ₹{t.defaultPrice.toLocaleString("en-IN")} {t.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedTemplate && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Quantity ({selectedTemplate.unit})</Label>
                        <Input
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Unit Price (₹)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-muted rounded-md flex justify-between text-sm">
                      <span>Total</span>
                      <span className="font-semibold">{formatCurrency(quantity * unitPrice)}</span>
                    </div>
                  </>
                )}
                <Button
                  className="w-full"
                  disabled={!selectedTemplateId || addAmenity.isPending}
                  onClick={() => addAmenity.mutate()}
                >
                  {addAmenity.isPending ? "Adding..." : "Add Amenity"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loadingAmenities ? (
        <p className="text-sm text-muted-foreground">Loading amenities...</p>
      ) : amenities.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No amenities added yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {amenities.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-3 bg-card border rounded-md">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColors[a.amenityTemplate?.category] ?? ""}`}>
                  {a.amenityTemplate?.category?.replace("_", " ") ?? "OTHER"}
                </span>
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.quantity} × {formatCurrency(a.unitPrice)}{a.amenityTemplate?.unit ? ` (${a.amenityTemplate.unit})` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">{formatCurrency(a.totalPrice)}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => removeAmenity.mutate(a.id)}
                    disabled={removeAmenity.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
