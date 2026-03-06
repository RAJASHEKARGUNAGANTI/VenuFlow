"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Truck } from "lucide-react";

export default function VendorsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Vendors</h2>
        <p className="text-sm text-muted-foreground">Manage caterers, decorators, DJs, and other vendors</p>
      </div>
      <Card className="text-center py-16">
        <CardContent>
          <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Vendor management coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
