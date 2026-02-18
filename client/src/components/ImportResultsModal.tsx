import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { localKpiSamples, localDriveRunSummaries } from '@/api/localStore';
import { parseFile, detectFormat, type ImportFormat, type KpiSampleInput } from '@/ai/kpiParsers';
import type { DriveKpi, KpiSample } from '@/types';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  Database,
  FileJson,
  FileSpreadsheet,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';

interface ImportResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  driveJobId: string;
  routeId: string;
  onImportComplete?: () => void;
}

const FORMAT_ICONS: Record<ImportFormat, typeof FileText> = {
  CSV: FileSpreadsheet,
  JSON: FileJson,
  GPX: MapPin,
  GEOJSON: MapPin,
  IPERF3: Database,
};

const FORMAT_LABELS: Record<ImportFormat, string> = {
  CSV: 'CSV (colonnes: timestamp, kpi_name, value, lat, lon)',
  JSON: 'JSON (tableau de samples ou {samples: [...]})',
  GPX: 'GPX (trackpoints avec extensions KPI)',
  GEOJSON: 'GeoJSON (FeatureCollection avec propriétés KPI)',
  IPERF3: 'iperf3 JSON (résultats iperf3 natifs)',
};

export default function ImportResultsModal({
  open,
  onOpenChange,
  campaignId,
  driveJobId,
  routeId,
  onImportComplete,
}: ImportResultsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState('');
  const [detectedFormat, setDetectedFormat] = useState<ImportFormat>('CSV');
  const [selectedFormat, setSelectedFormat] = useState<ImportFormat | 'AUTO'>('AUTO');
  const [preview, setPreview] = useState<{ samples: KpiSampleInput[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setImported(false);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setContent(text);
      const detected = detectFormat(f.name, text);
      setDetectedFormat(detected);
      // Auto-preview
      const format = selectedFormat === 'AUTO' ? detected : selectedFormat;
      const result = parseFile(text, format, {
        drive_job_id: driveJobId,
        campaign_id: campaignId,
        route_id: routeId,
      });
      setPreview(result);
    };
    reader.readAsText(f);
  }, [selectedFormat, driveJobId, campaignId, routeId]);

  const reparse = useCallback(() => {
    if (!content) return;
    const format = selectedFormat === 'AUTO' ? detectedFormat : selectedFormat;
    const result = parseFile(content, format, {
      drive_job_id: driveJobId,
      campaign_id: campaignId,
      route_id: routeId,
    });
    setPreview(result);
  }, [content, selectedFormat, detectedFormat, driveJobId, campaignId, routeId]);

  const doImport = useCallback(() => {
    if (!preview || preview.samples.length === 0) {
      toast.error('Aucun échantillon à importer');
      return;
    }
    setImporting(true);
    try {
      // Convert KpiSampleInput to KpiSample for bulkInsert
      const kpiSamples: KpiSample[] = preview.samples.map((s, i) => ({
        sample_id: `import-${Date.now()}-${i}`,
        drive_job_id: s.drive_job_id,
        campaign_id: s.campaign_id,
        route_id: s.route_id,
        timestamp: s.timestamp,
        lat: s.lat,
        lon: s.lon,
        kpi_name: s.kpi_name as DriveKpi,
        value: s.value,
        unit: s.unit,
        cell_id: s.cell_id,
        technology: s.technology as any,
      }));
      const count = localKpiSamples.bulkInsert(kpiSamples);

      // Recalculate summary using computeAndStore
      const thresholds: Record<string, number> = {
        RSRP: -100, RSRQ: -12, SINR: 5,
        THROUGHPUT_DL: 20, THROUGHPUT_UL: 5,
        LATENCY: 50, JITTER: 20, PACKET_LOSS: 1,
      };
      localDriveRunSummaries.computeAndStore(driveJobId, campaignId, thresholds);

      setImported(true);
      toast.success(`${count} échantillons importés, résumé recalculé`);
      onImportComplete?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  }, [preview, driveJobId, campaignId, routeId, onImportComplete]);

  const reset = () => {
    setFile(null);
    setContent('');
    setPreview(null);
    setImported(false);
    setSelectedFormat('AUTO');
  };

  const effectiveFormat = selectedFormat === 'AUTO' ? detectedFormat : selectedFormat;
  const FormatIcon = FORMAT_ICONS[effectiveFormat];

  // KPI distribution in preview
  const kpiDistribution = preview ? (() => {
    const map: Record<string, number> = {};
    for (const s of preview.samples) {
      map[s.kpi_name] = (map[s.kpi_name] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  })() : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-400" />
            Importer des résultats
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File selection */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            {!file ? (
              <label className="cursor-pointer block">
                <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Glissez un fichier ou cliquez pour sélectionner</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Formats acceptés : CSV, JSON, GPX, GeoJSON, iperf3 JSON
                </p>
                <input
                  type="file"
                  className="hidden"
                  accept=".csv,.json,.gpx,.geojson"
                  onChange={handleFileSelect}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FormatIcon className="w-8 h-8 text-blue-400" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB · Format détecté : {detectedFormat}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={reset}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Format override */}
          {file && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Format :</span>
              <Select value={selectedFormat} onValueChange={v => { setSelectedFormat(v as any); setTimeout(reparse, 50); }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">Auto ({detectedFormat})</SelectItem>
                  <SelectItem value="CSV">CSV</SelectItem>
                  <SelectItem value="JSON">JSON</SelectItem>
                  <SelectItem value="GPX">GPX</SelectItem>
                  <SelectItem value="GEOJSON">GeoJSON</SelectItem>
                  <SelectItem value="IPERF3">iperf3</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground flex-1">{FORMAT_LABELS[effectiveFormat]}</span>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="space-y-3">
              {/* Stats */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className="bg-emerald-600">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {preview.samples.length} échantillons
                </Badge>
                {preview.errors.length > 0 && (
                  <Badge variant="outline" className="text-amber-400 border-amber-400/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {preview.errors.length} avertissement(s)
                  </Badge>
                )}
              </div>

              {/* KPI distribution */}
              {kpiDistribution.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">KPIs :</span>
                  {kpiDistribution.map(([kpi, count]) => (
                    <Badge key={kpi} variant="outline" className="text-xs">
                      {kpi} ({count})
                    </Badge>
                  ))}
                </div>
              )}

              {/* Errors */}
              {preview.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto border border-amber-500/30 rounded p-3 bg-amber-500/5">
                  {preview.errors.slice(0, 10).map((err, i) => (
                    <p key={i} className="text-xs text-amber-400">{err}</p>
                  ))}
                  {preview.errors.length > 10 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ... et {preview.errors.length - 10} autre(s)
                    </p>
                  )}
                </div>
              )}

              {/* Sample preview table */}
              {preview.samples.length > 0 && (
                <div className="border border-border rounded overflow-hidden">
                  <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">
                    Aperçu (5 premiers échantillons)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="py-1.5 px-2">Timestamp</th>
                          <th className="py-1.5 px-2">KPI</th>
                          <th className="py-1.5 px-2">Valeur</th>
                          <th className="py-1.5 px-2">Unité</th>
                          <th className="py-1.5 px-2">Lat</th>
                          <th className="py-1.5 px-2">Lon</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.samples.slice(0, 5).map((s, i) => (
                          <tr key={i} className="border-b border-border/30">
                            <td className="py-1 px-2 font-mono">{new Date(s.timestamp).toLocaleTimeString('fr-FR')}</td>
                            <td className="py-1 px-2 font-medium">{s.kpi_name}</td>
                            <td className="py-1 px-2">{s.value.toFixed(1)}</td>
                            <td className="py-1 px-2 text-muted-foreground">{s.unit}</td>
                            <td className="py-1 px-2">{s.lat.toFixed(4)}</td>
                            <td className="py-1 px-2">{s.lon.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import success */}
              {imported && (
                <div className="flex items-center gap-2 p-3 rounded bg-emerald-500/10 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-emerald-400">Import terminé. Le rapport sera mis à jour automatiquement.</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          {preview && preview.samples.length > 0 && !imported && (
            <Button onClick={doImport} disabled={importing} className="bg-blue-600 hover:bg-blue-700">
              {importing ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Import en cours...</>
              ) : (
                <><Database className="w-4 h-4 mr-1" /> Importer {preview.samples.length} échantillons</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
