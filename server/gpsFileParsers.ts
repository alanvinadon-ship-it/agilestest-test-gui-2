// ============================================================================
// AgilesTest — GPS File Parsers (GPX, KML, CSV)
// Extracts GPS samples from uploaded trace files into a unified format
// ============================================================================

import { XMLParser } from "fast-xml-parser";

// ── Unified GPS Sample Type ─────────────────────────────────────────────────

export interface ParsedGpsSample {
  lat: number;
  lon: number;
  altitudeM: number | null;
  speedMps: number | null;
  accuracyM: number | null;
  ts: Date;
}

export interface ParseResult {
  samples: ParsedGpsSample[];
  format: "GPX" | "KML" | "CSV";
  trackName: string | null;
  errors: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function isValidCoord(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

// ── GPX Parser ──────────────────────────────────────────────────────────────

/**
 * Parse a GPX file (GPS Exchange Format).
 * Supports <trk>/<trkseg>/<trkpt> and <wpt> elements.
 * Extracts: lat, lon, ele (altitude), time, speed (extensions).
 */
export function parseGpx(content: string): ParseResult {
  const errors: string[] = [];
  const samples: ParsedGpsSample[] = [];
  let trackName: string | null = null;

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => ["trk", "trkseg", "trkpt", "wpt", "rtept"].includes(name),
  });

  let parsed: any;
  try {
    parsed = parser.parse(content);
  } catch (e: any) {
    return { samples: [], format: "GPX", trackName: null, errors: [`Erreur XML: ${e.message}`] };
  }

  const gpx = parsed?.gpx;
  if (!gpx) {
    return { samples: [], format: "GPX", trackName: null, errors: ["Élément <gpx> introuvable"] };
  }

  // Extract track points from <trk>/<trkseg>/<trkpt>
  const tracks = Array.isArray(gpx.trk) ? gpx.trk : gpx.trk ? [gpx.trk] : [];
  for (const trk of tracks) {
    if (!trackName && trk.name) trackName = String(trk.name);
    const segments = Array.isArray(trk.trkseg) ? trk.trkseg : trk.trkseg ? [trk.trkseg] : [];
    for (const seg of segments) {
      const points = Array.isArray(seg.trkpt) ? seg.trkpt : seg.trkpt ? [seg.trkpt] : [];
      for (const pt of points) {
        const lat = toNum(pt["@_lat"]);
        const lon = toNum(pt["@_lon"]);
        if (lat == null || lon == null || !isValidCoord(lat, lon)) {
          errors.push(`Point GPS invalide: lat=${pt["@_lat"]}, lon=${pt["@_lon"]}`);
          continue;
        }

        const time = toDate(pt.time);
        if (!time) {
          errors.push(`Horodatage manquant/invalide pour point (${lat}, ${lon})`);
          continue;
        }

        // Speed from extensions (Garmin, etc.)
        let speedMps = toNum(pt.speed);
        if (speedMps == null) {
          // Try extensions
          const ext = pt.extensions;
          if (ext) {
            speedMps = toNum(ext.speed) ?? toNum(ext["gpxtpx:TrackPointExtension"]?.["gpxtpx:speed"]);
          }
        }

        samples.push({
          lat,
          lon,
          altitudeM: toNum(pt.ele),
          speedMps,
          accuracyM: toNum(pt.hdop) ?? toNum(pt.pdop),
          ts: time,
        });
      }
    }
  }

  // Also extract waypoints <wpt>
  const waypoints = Array.isArray(gpx.wpt) ? gpx.wpt : gpx.wpt ? [gpx.wpt] : [];
  for (const wpt of waypoints) {
    const lat = toNum(wpt["@_lat"]);
    const lon = toNum(wpt["@_lon"]);
    if (lat == null || lon == null || !isValidCoord(lat, lon)) continue;
    const time = toDate(wpt.time);
    if (!time) continue;

    samples.push({
      lat,
      lon,
      altitudeM: toNum(wpt.ele),
      speedMps: null,
      accuracyM: null,
      ts: time,
    });
  }

  // Sort by timestamp
  samples.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  if (samples.length === 0 && errors.length === 0) {
    errors.push("Aucun point GPS valide trouvé dans le fichier GPX");
  }

  return { samples, format: "GPX", trackName, errors };
}

// ── KML Parser ──────────────────────────────────────────────────────────────

/**
 * Parse a KML file (Keyhole Markup Language).
 * Supports <Placemark>/<LineString>/<coordinates>, <Point>/<coordinates>,
 * and <gx:Track>/<gx:coord> + <when>.
 */
export function parseKml(content: string): ParseResult {
  const errors: string[] = [];
  const samples: ParsedGpsSample[] = [];
  let trackName: string | null = null;

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) =>
      ["Placemark", "coordinates", "when", "gx:coord", "coord"].includes(name),
  });

  let parsed: any;
  try {
    parsed = parser.parse(content);
  } catch (e: any) {
    return { samples: [], format: "KML", trackName: null, errors: [`Erreur XML: ${e.message}`] };
  }

  // Navigate to Document (may be nested)
  const kml = parsed?.kml;
  if (!kml) {
    return { samples: [], format: "KML", trackName: null, errors: ["Élément <kml> introuvable"] };
  }

  const doc = kml.Document ?? kml;

  // Recursively find all Placemarks
  function findPlacemarks(node: any): any[] {
    const result: any[] = [];
    if (!node || typeof node !== "object") return result;

    if (node.Placemark) {
      const pms = Array.isArray(node.Placemark) ? node.Placemark : [node.Placemark];
      result.push(...pms);
    }
    if (node.Folder) {
      const folders = Array.isArray(node.Folder) ? node.Folder : [node.Folder];
      for (const f of folders) result.push(...findPlacemarks(f));
    }
    return result;
  }

  const placemarks = findPlacemarks(doc);

  for (const pm of placemarks) {
    if (!trackName && pm.name) trackName = String(pm.name);

    // LineString coordinates: "lon,lat,alt lon,lat,alt ..."
    const lineString = pm.LineString;
    if (lineString?.coordinates) {
      const coordStr = String(
        Array.isArray(lineString.coordinates) ? lineString.coordinates[0] : lineString.coordinates
      ).trim();
      const tuples = coordStr.split(/\s+/).filter(Boolean);

      // KML LineString doesn't have timestamps per point — use current time with 1s intervals
      const baseTime = new Date();
      for (let i = 0; i < tuples.length; i++) {
        const parts = tuples[i].split(",");
        const lon = toNum(parts[0]);
        const lat = toNum(parts[1]);
        const alt = toNum(parts[2]);
        if (lat == null || lon == null || !isValidCoord(lat, lon)) continue;

        samples.push({
          lat,
          lon,
          altitudeM: alt,
          speedMps: null,
          accuracyM: null,
          ts: new Date(baseTime.getTime() + i * 1000),
        });
      }
    }

    // Point coordinates
    const point = pm.Point;
    if (point?.coordinates) {
      const coordStr = String(
        Array.isArray(point.coordinates) ? point.coordinates[0] : point.coordinates
      ).trim();
      const parts = coordStr.split(",");
      const lon = toNum(parts[0]);
      const lat = toNum(parts[1]);
      const alt = toNum(parts[2]);
      if (lat != null && lon != null && isValidCoord(lat, lon)) {
        samples.push({
          lat,
          lon,
          altitudeM: alt,
          speedMps: null,
          accuracyM: null,
          ts: new Date(),
        });
      }
    }

    // gx:Track format: <when> + <gx:coord> pairs
    const gxTrack = pm["gx:Track"] ?? pm.Track;
    if (gxTrack) {
      const whens = Array.isArray(gxTrack.when) ? gxTrack.when : gxTrack.when ? [gxTrack.when] : [];
      const coords =
        Array.isArray(gxTrack["gx:coord"])
          ? gxTrack["gx:coord"]
          : gxTrack["gx:coord"]
          ? [gxTrack["gx:coord"]]
          : Array.isArray(gxTrack.coord)
          ? gxTrack.coord
          : gxTrack.coord
          ? [gxTrack.coord]
          : [];

      const count = Math.min(whens.length, coords.length);
      for (let i = 0; i < count; i++) {
        const time = toDate(whens[i]);
        if (!time) continue;

        const parts = String(coords[i]).trim().split(/\s+/);
        const lon = toNum(parts[0]);
        const lat = toNum(parts[1]);
        const alt = toNum(parts[2]);
        if (lat == null || lon == null || !isValidCoord(lat, lon)) continue;

        samples.push({
          lat,
          lon,
          altitudeM: alt,
          speedMps: null,
          accuracyM: null,
          ts: time,
        });
      }
    }
  }

  // Sort by timestamp
  samples.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  if (samples.length === 0 && errors.length === 0) {
    errors.push("Aucun point GPS valide trouvé dans le fichier KML");
  }

  return { samples, format: "KML", trackName, errors };
}

// ── CSV Parser ──────────────────────────────────────────────────────────────

/**
 * Parse a CSV file containing GPS data.
 * Auto-detects column headers: lat/latitude, lon/longitude/lng, time/timestamp/datetime,
 * speed/speed_mps/speed_kmh, alt/altitude/elevation, accuracy/hdop.
 * Supports comma, semicolon, and tab delimiters.
 */
export function parseCsv(content: string): ParseResult {
  const errors: string[] = [];
  const samples: ParsedGpsSample[] = [];

  // Detect delimiter
  const firstLine = content.split("\n")[0] ?? "";
  let delimiter = ",";
  if (firstLine.includes("\t")) delimiter = "\t";
  else if (firstLine.split(";").length > firstLine.split(",").length) delimiter = ";";

  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { samples: [], format: "CSV", trackName: null, errors: ["Le fichier CSV doit contenir au moins un en-tête et une ligne de données"] };
  }

  // Parse header
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  // Map columns by common names
  const colMap = {
    lat: headers.findIndex((h) => ["lat", "latitude", "lat_deg", "y"].includes(h)),
    lon: headers.findIndex((h) => ["lon", "lng", "longitude", "lon_deg", "long", "x"].includes(h)),
    time: headers.findIndex((h) => ["time", "timestamp", "datetime", "date_time", "ts", "utc_time", "gps_time"].includes(h)),
    speed: headers.findIndex((h) => ["speed", "speed_mps", "speed_ms", "velocity", "spd"].includes(h)),
    speedKmh: headers.findIndex((h) => ["speed_kmh", "speed_kph", "vitesse", "vitesse_kmh"].includes(h)),
    alt: headers.findIndex((h) => ["alt", "altitude", "elevation", "ele", "height", "alt_m"].includes(h)),
    accuracy: headers.findIndex((h) => ["accuracy", "hdop", "pdop", "precision", "accuracy_m", "hacc"].includes(h)),
  };

  if (colMap.lat === -1 || colMap.lon === -1) {
    return {
      samples: [],
      format: "CSV",
      trackName: null,
      errors: [`Colonnes latitude/longitude introuvables. En-têtes détectés: ${headers.join(", ")}`],
    };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^['"]|['"]$/g, ""));

    const lat = toNum(cols[colMap.lat]);
    const lon = toNum(cols[colMap.lon]);
    if (lat == null || lon == null || !isValidCoord(lat, lon)) {
      errors.push(`Ligne ${i + 1}: coordonnées invalides (${cols[colMap.lat]}, ${cols[colMap.lon]})`);
      continue;
    }

    // Time: try mapped column, fallback to epoch-based
    let ts: Date | null = null;
    if (colMap.time !== -1 && cols[colMap.time]) {
      ts = toDate(cols[colMap.time]);
      // Try as Unix timestamp (seconds or milliseconds)
      if (!ts) {
        const num = Number(cols[colMap.time]);
        if (Number.isFinite(num)) {
          ts = num > 1e12 ? new Date(num) : new Date(num * 1000);
          if (isNaN(ts.getTime())) ts = null;
        }
      }
    }
    if (!ts) {
      // Fallback: use line index as offset from epoch
      ts = new Date(Date.now() - (lines.length - 1 - i) * 1000);
    }

    // Speed
    let speedMps: number | null = null;
    if (colMap.speed !== -1) speedMps = toNum(cols[colMap.speed]);
    if (speedMps == null && colMap.speedKmh !== -1) {
      const kmh = toNum(cols[colMap.speedKmh]);
      if (kmh != null) speedMps = kmh / 3.6;
    }

    samples.push({
      lat,
      lon,
      altitudeM: colMap.alt !== -1 ? toNum(cols[colMap.alt]) : null,
      speedMps,
      accuracyM: colMap.accuracy !== -1 ? toNum(cols[colMap.accuracy]) : null,
      ts,
    });
  }

  // Sort by timestamp
  samples.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  if (samples.length === 0 && errors.length === 0) {
    errors.push("Aucun point GPS valide trouvé dans le fichier CSV");
  }

  return { samples, format: "CSV", trackName: null, errors };
}

// ── Format Detection ────────────────────────────────────────────────────────

/**
 * Detect file format from filename extension and parse accordingly.
 */
export function parseGpsFile(content: string, filename: string): ParseResult {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  switch (ext) {
    case "gpx":
      return parseGpx(content);
    case "kml":
      return parseKml(content);
    case "csv":
    case "tsv":
    case "txt":
      return parseCsv(content);
    default:
      // Try to auto-detect by content
      const trimmed = content.trim();
      if (trimmed.startsWith("<?xml") || trimmed.startsWith("<gpx")) {
        if (trimmed.includes("<gpx") || trimmed.includes("gpx:")) return parseGpx(content);
        if (trimmed.includes("<kml") || trimmed.includes("kml:")) return parseKml(content);
      }
      // Fallback to CSV
      return parseCsv(content);
  }
}
