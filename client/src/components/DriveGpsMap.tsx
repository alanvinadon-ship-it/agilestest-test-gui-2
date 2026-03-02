import { useRef, useCallback, useMemo } from 'react';
import { MapView } from '@/components/Map';
import { MapPin, Navigation, Gauge, Clock, Route, Mountain } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GpsSample {
  id?: number;
  lat: number;
  lon: number;
  speedMps?: number | null;
  altitudeM?: number | null;
  accuracyM?: number | null;
  headingDeg?: number | null;
  ts?: Date | string | null;
  source?: string;
}

interface DriveGpsMapProps {
  samples: GpsSample[];
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert speed m/s to km/h */
function mpsToKmh(mps: number | null | undefined): number {
  return mps != null ? mps * 3.6 : 0;
}

/** Haversine distance in meters between two lat/lon points */
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Get color for speed (green = slow, yellow = medium, red = fast) */
function speedColor(kmh: number): string {
  if (kmh < 20) return '#22c55e';   // green
  if (kmh < 50) return '#eab308';   // yellow
  if (kmh < 80) return '#f97316';   // orange
  return '#ef4444';                   // red
}

/** Format duration from seconds */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DriveGpsMap({ samples, className }: DriveGpsMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<google.maps.MVCObject[]>([]);

  // Compute stats
  const stats = useMemo(() => {
    if (samples.length === 0) return null;

    let totalDistanceM = 0;
    let maxSpeedKmh = 0;
    let totalSpeedKmh = 0;
    let speedCount = 0;
    let minAlt = Infinity;
    let maxAlt = -Infinity;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const kmh = mpsToKmh(s.speedMps);
      if (s.speedMps != null) {
        totalSpeedKmh += kmh;
        speedCount++;
        if (kmh > maxSpeedKmh) maxSpeedKmh = kmh;
      }
      if (s.altitudeM != null) {
        if (s.altitudeM < minAlt) minAlt = s.altitudeM;
        if (s.altitudeM > maxAlt) maxAlt = s.altitudeM;
      }
      if (i > 0) {
        totalDistanceM += haversineM(samples[i - 1].lat, samples[i - 1].lon, s.lat, s.lon);
      }
    }

    const firstTs = samples[0].ts ? new Date(samples[0].ts as string | number).getTime() : 0;
    const lastTs = samples[samples.length - 1].ts ? new Date(samples[samples.length - 1].ts as string | number).getTime() : 0;
    const durationSec = firstTs && lastTs ? (lastTs - firstTs) / 1000 : 0;

    return {
      points: samples.length,
      distanceKm: totalDistanceM / 1000,
      durationSec,
      avgSpeedKmh: speedCount > 0 ? totalSpeedKmh / speedCount : 0,
      maxSpeedKmh,
      minAlt: minAlt === Infinity ? null : minAlt,
      maxAlt: maxAlt === -Infinity ? null : maxAlt,
    };
  }, [samples]);

  // Map center from first sample
  const initialCenter = useMemo(() => {
    if (samples.length === 0) return { lat: 48.8566, lng: 2.3522 }; // Paris default
    return { lat: samples[0].lat, lng: samples[0].lon };
  }, [samples]);

  // Draw track on map ready
  const handleMapReady = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      // Clear previous overlays
      overlaysRef.current.forEach((o: any) => {
        if (o.setMap) o.setMap(null);
      });
      overlaysRef.current = [];

      if (samples.length === 0) return;

      const bounds = new google.maps.LatLngBounds();
      const path = samples.map((s) => {
        const pos = { lat: s.lat, lng: s.lon };
        bounds.extend(pos);
        return pos;
      });

      // Draw segmented polylines colored by speed
      for (let i = 1; i < samples.length; i++) {
        const kmh = mpsToKmh(samples[i].speedMps);
        const segment = new google.maps.Polyline({
          path: [path[i - 1], path[i]],
          strokeColor: speedColor(kmh),
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map,
        });
        overlaysRef.current.push(segment);
      }

      // If only 1 point, draw a single polyline for visibility
      if (samples.length === 1) {
        // Just show the marker, no polyline needed
      }

      // Start marker (green)
      const startContent = document.createElement('div');
      startContent.innerHTML = `<div style="background:#22c55e;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">D</div>`;
      const startMarker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: path[0],
        title: 'Départ',
        content: startContent,
      });

      const startInfo = new google.maps.InfoWindow({
        content: `<div style="font-family:sans-serif;font-size:13px;color:#333;">
          <strong>Départ</strong><br/>
          ${samples[0].ts ? new Date(samples[0].ts).toLocaleString('fr-FR') : '—'}<br/>
          <span style="color:#666;">Lat: ${samples[0].lat.toFixed(6)}, Lon: ${samples[0].lon.toFixed(6)}</span>
        </div>`,
      });
      startMarker.addListener('click', () => startInfo.open({ anchor: startMarker, map }));
      overlaysRef.current.push(startMarker as any);

      // End marker (red) — only if more than 1 point
      if (samples.length > 1) {
        const last = samples[samples.length - 1];
        const endContent = document.createElement('div');
        endContent.innerHTML = `<div style="background:#ef4444;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">F</div>`;
        const endMarker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: path[path.length - 1],
          title: 'Arrivée',
          content: endContent,
        });

        const endInfo = new google.maps.InfoWindow({
          content: `<div style="font-family:sans-serif;font-size:13px;color:#333;">
            <strong>Arrivée</strong><br/>
            ${last.ts ? new Date(last.ts).toLocaleString('fr-FR') : '—'}<br/>
            <span style="color:#666;">Lat: ${last.lat.toFixed(6)}, Lon: ${last.lon.toFixed(6)}</span>
            ${last.speedMps != null ? `<br/>Vitesse: ${mpsToKmh(last.speedMps).toFixed(1)} km/h` : ''}
          </div>`,
        });
        endMarker.addListener('click', () => endInfo.open({ anchor: endMarker, map }));
        overlaysRef.current.push(endMarker as any);
      }

      // Fit bounds
      if (samples.length > 1) {
        map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
      } else {
        map.setCenter(path[0]);
        map.setZoom(16);
      }
    },
    [samples]
  );

  if (samples.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucun point GPS enregistré.</p>
        <p className="text-xs mt-1">Les points GPS sont collectés automatiquement pendant le run.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={MapPin}
            label="Points GPS"
            value={stats.points.toLocaleString('fr-FR')}
          />
          <StatCard
            icon={Route}
            label="Distance"
            value={stats.distanceKm < 1
              ? `${(stats.distanceKm * 1000).toFixed(0)} m`
              : `${stats.distanceKm.toFixed(2)} km`
            }
          />
          <StatCard
            icon={Clock}
            label="Durée"
            value={stats.durationSec > 0 ? formatDuration(stats.durationSec) : '—'}
          />
          <StatCard
            icon={Gauge}
            label="Vitesse moy."
            value={stats.avgSpeedKmh > 0 ? `${stats.avgSpeedKmh.toFixed(1)} km/h` : '—'}
          />
          <StatCard
            icon={Navigation}
            label="Vitesse max"
            value={stats.maxSpeedKmh > 0 ? `${stats.maxSpeedKmh.toFixed(1)} km/h` : '—'}
          />
          <StatCard
            icon={Mountain}
            label="Altitude"
            value={stats.minAlt != null && stats.maxAlt != null
              ? `${stats.minAlt.toFixed(0)}–${stats.maxAlt.toFixed(0)} m`
              : '—'
            }
          />
        </div>
      )}

      {/* Speed legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="font-medium">Vitesse :</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
          &lt;20 km/h
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ background: '#eab308' }} />
          20–50
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ background: '#f97316' }} />
          50–80
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
          &gt;80 km/h
        </span>
      </div>

      {/* Map */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <MapView
          className={`w-full h-[400px] sm:h-[500px] ${className ?? ''}`}
          initialCenter={initialCenter}
          initialZoom={14}
          onMapReady={handleMapReady}
        />
      </div>
    </div>
  );
}

// ─── StatCard ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-center">
      <Icon className="w-4 h-4 text-primary mx-auto mb-1" />
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
