import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function Reportes() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Próximamente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            La sección de reportes estará disponible próximamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
