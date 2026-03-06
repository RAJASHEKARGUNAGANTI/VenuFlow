"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function ResourcesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Resources & Inventory</h2>
        <p className="text-sm text-muted-foreground">Manage tables, chairs, AV equipment, and other resources</p>
      </div>
      <Card className="text-center py-16">
        <CardContent>
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Resource management coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
