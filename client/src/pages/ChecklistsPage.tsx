import { useTestContext } from "@/contexts/TestContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ListChecks,
  ClipboardCheck,
  Gauge,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const checklistMeta: Record<string, { title: string; icon: React.ReactNode; color: string }> = {
  "vabf-avant": { title: "VABF — Pré-requis", icon: <ClipboardCheck className="w-4 h-4 text-blue-400" />, color: "text-blue-400" },
  "vabf-apres": { title: "VABF — Post-test", icon: <ClipboardCheck className="w-4 h-4 text-blue-400" />, color: "text-blue-400" },
  "vabe-avant": { title: "VABE — Pré-requis", icon: <Gauge className="w-4 h-4 text-orange-400" />, color: "text-orange-400" },
  "vabe-apres": { title: "VABE — Post-test", icon: <Gauge className="w-4 h-4 text-orange-400" />, color: "text-orange-400" },
};

export default function ChecklistsPage() {
  const { checklists, toggleChecklistItem } = useTestContext();

  const totalChecked = Object.values(checklists).flat().filter(i => i.checked).length;
  const totalItems = Object.values(checklists).flat().length;
  const overallProgress = totalItems > 0 ? Math.round((totalChecked / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Checklists Jour J</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Vérifications pré et post-test pour les campagnes VABF et VABE
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-sm gap-2">
          <ListChecks className="w-4 h-4" />
          {totalChecked} / {totalItems}
        </Badge>
      </div>

      {/* Overall progress */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progression globale</span>
            <span className="font-mono text-sm text-foreground">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-3" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> {totalChecked} complétés</span>
            <span className="flex items-center gap-1"><Circle className="w-3 h-3" /> {totalItems - totalChecked} restants</span>
          </div>
        </CardContent>
      </Card>

      {/* Checklist cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(checklists).map(([category, items]) => {
          const meta = checklistMeta[category];
          const checked = items.filter(i => i.checked).length;
          const progress = items.length > 0 ? Math.round((checked / items.length) * 100) : 0;
          const isComplete = checked === items.length;

          return (
            <Card key={category} className={cn("bg-card border-border", isComplete && "border-emerald-500/30")}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-sm flex items-center gap-2">
                    {meta?.icon}
                    {meta?.title ?? category}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{checked}/{items.length}</span>
                    {isComplete && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                </div>
                <Progress value={progress} className="h-1.5 mt-2" />
              </CardHeader>
              <CardContent className="space-y-1">
                {items.map(item => (
                  <label
                    key={item.id}
                    className={cn(
                      "flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors",
                      item.checked ? "bg-emerald-500/5" : "hover:bg-secondary/50"
                    )}
                  >
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={() => toggleChecklistItem(category, item.id)}
                      className="mt-0.5"
                    />
                    <span className={cn(
                      "text-sm transition-colors",
                      item.checked ? "text-emerald-300 line-through" : "text-foreground"
                    )}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
