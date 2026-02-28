// ============================================================================
// AgilesTest — GPS File Parsers Tests
// Tests for GPX, KML, CSV parsers + parseGpsFile dispatcher
// ============================================================================

import { describe, it, expect } from "vitest";
import { parseGpx, parseKml, parseCsv, parseGpsFile } from "./gpsFileParsers";
import type { ParseResult } from "./gpsFileParsers";

// ── Sample data ────────────────────────────────────────────────────────────

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="AgilesTest"
  xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Test Track Abidjan</name>
    <trkseg>
      <trkpt lat="5.3600" lon="-4.0083">
        <ele>18.5</ele>
        <time>2026-01-15T10:00:00Z</time>
        <speed>1.2</speed>
      </trkpt>
      <trkpt lat="5.3610" lon="-4.0073">
        <ele>19.0</ele>
        <time>2026-01-15T10:00:05Z</time>
        <speed>2.5</speed>
        <hdop>3.2</hdop>
      </trkpt>
      <trkpt lat="5.3620" lon="-4.0063">
        <ele>20.0</ele>
        <time>2026-01-15T10:00:10Z</time>
      </trkpt>
    </trkseg>
  </trk>
  <wpt lat="5.3500" lon="-4.0200">
    <ele>10.0</ele>
    <time>2026-01-15T09:00:00Z</time>
    <name>Start Point</name>
  </wpt>
</gpx>`;

const SAMPLE_GPX_MULTI_TRACK = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Track A</name>
    <trkseg>
      <trkpt lat="5.3600" lon="-4.0083">
        <time>2026-01-15T10:00:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
  <trk>
    <name>Track B</name>
    <trkseg>
      <trkpt lat="5.3700" lon="-4.0183">
        <time>2026-01-15T11:00:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

const SAMPLE_GPX_GARMIN_EXT = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Garmin Track</name>
    <trkseg>
      <trkpt lat="5.3600" lon="-4.0083">
        <time>2026-01-15T10:00:00Z</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:speed>3.5</gpxtpx:speed>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

const SAMPLE_KML_LINESTRING = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Test KML</name>
    <Placemark>
      <name>Drive Route</name>
      <LineString>
        <coordinates>
          -4.0083,5.3600,18.5
          -4.0073,5.3610,19.0
          -4.0063,5.3620,20.0
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

const SAMPLE_KML_GX_TRACK = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <Placemark>
      <name>GPS Track</name>
      <gx:Track>
        <when>2026-01-15T10:00:00Z</when>
        <when>2026-01-15T10:00:05Z</when>
        <when>2026-01-15T10:00:10Z</when>
        <gx:coord>-4.0083 5.3600 18.5</gx:coord>
        <gx:coord>-4.0073 5.3610 19.0</gx:coord>
        <gx:coord>-4.0063 5.3620 20.0</gx:coord>
      </gx:Track>
    </Placemark>
  </Document>
</kml>`;

const SAMPLE_KML_POINT = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Single Point</name>
      <Point>
        <coordinates>-4.0083,5.3600,18.5</coordinates>
      </Point>
    </Placemark>
  </Document>
</kml>`;

const SAMPLE_KML_FOLDER = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>Test Folder</name>
      <Placemark>
        <name>Nested Point</name>
        <Point>
          <coordinates>-4.0083,5.3600,18.5</coordinates>
        </Point>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

const SAMPLE_CSV_COMMA = `lat,lon,altitude,speed,timestamp
5.3600,-4.0083,18.5,1.2,2026-01-15T10:00:00Z
5.3610,-4.0073,19.0,2.5,2026-01-15T10:00:05Z
5.3620,-4.0063,20.0,,2026-01-15T10:00:10Z`;

const SAMPLE_CSV_SEMICOLON = `latitude;longitude;elevation;speed_kmh;datetime
5.3600;-4.0083;18.5;4.32;2026-01-15T10:00:00Z
5.3610;-4.0073;19.0;9.0;2026-01-15T10:00:05Z`;

const SAMPLE_CSV_TAB = `lat\tlon\talt\tspeed\ttime
5.3600\t-4.0083\t18.5\t1.2\t2026-01-15T10:00:00Z
5.3610\t-4.0073\t19.0\t2.5\t2026-01-15T10:00:05Z`;

const SAMPLE_CSV_UNIX_TS = `lat,lon,ts
5.3600,-4.0083,1736935200
5.3610,-4.0073,1736935205`;

const SAMPLE_CSV_QUOTED = `"lat","lon","altitude","time"
"5.3600","-4.0083","18.5","2026-01-15T10:00:00Z"
"5.3610","-4.0073","19.0","2026-01-15T10:00:05Z"`;

// ── GPX Parser Tests ───────────────────────────────────────────────────────

describe("parseGpx", () => {
  it("parses a standard GPX file with track points and waypoints", () => {
    const result = parseGpx(SAMPLE_GPX);
    expect(result.format).toBe("GPX");
    expect(result.trackName).toBe("Test Track Abidjan");
    expect(result.errors).toHaveLength(0);
    // 3 track points + 1 waypoint = 4
    expect(result.samples).toHaveLength(4);
  });

  it("extracts correct lat/lon from track points", () => {
    const result = parseGpx(SAMPLE_GPX);
    // Waypoint comes first (sorted by time: 09:00 < 10:00)
    const wpt = result.samples[0];
    expect(wpt.lat).toBeCloseTo(5.35, 2);
    expect(wpt.lon).toBeCloseTo(-4.02, 2);

    const trkpt = result.samples[1];
    expect(trkpt.lat).toBeCloseTo(5.36, 2);
    expect(trkpt.lon).toBeCloseTo(-4.0083, 4);
  });

  it("extracts altitude from <ele> element", () => {
    const result = parseGpx(SAMPLE_GPX);
    const trkpt = result.samples[1]; // first track point
    expect(trkpt.altitudeM).toBeCloseTo(18.5, 1);
  });

  it("extracts speed from <speed> element", () => {
    const result = parseGpx(SAMPLE_GPX);
    const trkpt = result.samples[1];
    expect(trkpt.speedMps).toBeCloseTo(1.2, 1);
  });

  it("extracts accuracy from <hdop>", () => {
    const result = parseGpx(SAMPLE_GPX);
    const trkpt2 = result.samples[2]; // second track point has hdop
    expect(trkpt2.accuracyM).toBeCloseTo(3.2, 1);
  });

  it("extracts timestamps and sorts by time", () => {
    const result = parseGpx(SAMPLE_GPX);
    for (let i = 1; i < result.samples.length; i++) {
      expect(result.samples[i].ts.getTime()).toBeGreaterThanOrEqual(
        result.samples[i - 1].ts.getTime()
      );
    }
  });

  it("handles multiple tracks", () => {
    const result = parseGpx(SAMPLE_GPX_MULTI_TRACK);
    expect(result.samples).toHaveLength(2);
    expect(result.trackName).toBe("Track A");
  });

  it("extracts speed from Garmin extensions", () => {
    const result = parseGpx(SAMPLE_GPX_GARMIN_EXT);
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].speedMps).toBeCloseTo(3.5, 1);
  });

  it("returns error for invalid XML", () => {
    const result = parseGpx("<not valid xml");
    expect(result.samples).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns error when <gpx> element is missing", () => {
    const result = parseGpx('<?xml version="1.0"?><root></root>');
    expect(result.samples).toHaveLength(0);
    expect(result.errors).toContain("Élément <gpx> introuvable");
  });

  it("returns error for empty GPX with no points", () => {
    const result = parseGpx('<?xml version="1.0"?><gpx></gpx>');
    expect(result.samples).toHaveLength(0);
    // fast-xml-parser may not find <gpx> as object when empty, so either error is acceptable
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("skips points with invalid coordinates", () => {
    const gpx = `<?xml version="1.0"?>
    <gpx><trk><trkseg>
      <trkpt lat="200" lon="-4.0083"><time>2026-01-15T10:00:00Z</time></trkpt>
      <trkpt lat="5.36" lon="-4.0083"><time>2026-01-15T10:00:05Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const result = parseGpx(gpx);
    expect(result.samples).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("skips points with missing timestamps", () => {
    const gpx = `<?xml version="1.0"?>
    <gpx><trk><trkseg>
      <trkpt lat="5.36" lon="-4.0083"></trkpt>
      <trkpt lat="5.37" lon="-4.0073"><time>2026-01-15T10:00:05Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const result = parseGpx(gpx);
    expect(result.samples).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles null speed gracefully", () => {
    const result = parseGpx(SAMPLE_GPX);
    const lastTrkpt = result.samples[3]; // third track point has no speed
    expect(lastTrkpt.speedMps).toBeNull();
  });
});

// ── KML Parser Tests ───────────────────────────────────────────────────────

describe("parseKml", () => {
  it("parses LineString coordinates", () => {
    const result = parseKml(SAMPLE_KML_LINESTRING);
    expect(result.format).toBe("KML");
    expect(result.trackName).toBe("Drive Route");
    expect(result.samples).toHaveLength(3);
  });

  it("extracts correct lat/lon from LineString (KML order: lon,lat,alt)", () => {
    const result = parseKml(SAMPLE_KML_LINESTRING);
    const pt = result.samples[0];
    expect(pt.lat).toBeCloseTo(5.36, 2);
    expect(pt.lon).toBeCloseTo(-4.0083, 4);
    expect(pt.altitudeM).toBeCloseTo(18.5, 1);
  });

  it("parses gx:Track with when/coord pairs", () => {
    const result = parseKml(SAMPLE_KML_GX_TRACK);
    expect(result.samples).toHaveLength(3);
    expect(result.trackName).toBe("GPS Track");
  });

  it("extracts timestamps from gx:Track", () => {
    const result = parseKml(SAMPLE_KML_GX_TRACK);
    expect(result.samples[0].ts).toEqual(new Date("2026-01-15T10:00:00Z"));
    expect(result.samples[1].ts).toEqual(new Date("2026-01-15T10:00:05Z"));
  });

  it("parses Point coordinates", () => {
    const result = parseKml(SAMPLE_KML_POINT);
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].lat).toBeCloseTo(5.36, 2);
    expect(result.samples[0].lon).toBeCloseTo(-4.0083, 4);
  });

  it("finds Placemarks inside Folders", () => {
    const result = parseKml(SAMPLE_KML_FOLDER);
    expect(result.samples).toHaveLength(1);
  });

  it("returns error for invalid XML", () => {
    const result = parseKml("<not valid xml");
    expect(result.samples).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns error when <kml> element is missing", () => {
    const result = parseKml('<?xml version="1.0"?><root></root>');
    expect(result.samples).toHaveLength(0);
    expect(result.errors).toContain("Élément <kml> introuvable");
  });

  it("returns error for empty KML with no points", () => {
    const result = parseKml('<?xml version="1.0"?><kml><Document></Document></kml>');
    expect(result.samples).toHaveLength(0);
    expect(result.errors).toContain("Aucun point GPS valide trouvé dans le fichier KML");
  });

  it("handles altitude in gx:Track", () => {
    const result = parseKml(SAMPLE_KML_GX_TRACK);
    expect(result.samples[0].altitudeM).toBeCloseTo(18.5, 1);
  });
});

// ── CSV Parser Tests ───────────────────────────────────────────────────────

describe("parseCsv", () => {
  it("parses comma-delimited CSV", () => {
    const result = parseCsv(SAMPLE_CSV_COMMA);
    expect(result.format).toBe("CSV");
    expect(result.samples).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });

  it("extracts correct lat/lon from CSV", () => {
    const result = parseCsv(SAMPLE_CSV_COMMA);
    expect(result.samples[0].lat).toBeCloseTo(5.36, 2);
    expect(result.samples[0].lon).toBeCloseTo(-4.0083, 4);
  });

  it("extracts altitude and speed", () => {
    const result = parseCsv(SAMPLE_CSV_COMMA);
    expect(result.samples[0].altitudeM).toBeCloseTo(18.5, 1);
    expect(result.samples[0].speedMps).toBeCloseTo(1.2, 1);
  });

  it("handles missing speed values", () => {
    const result = parseCsv(SAMPLE_CSV_COMMA);
    expect(result.samples[2].speedMps).toBeNull();
  });

  it("parses semicolon-delimited CSV", () => {
    const result = parseCsv(SAMPLE_CSV_SEMICOLON);
    expect(result.samples).toHaveLength(2);
    expect(result.samples[0].lat).toBeCloseTo(5.36, 2);
  });

  it("converts speed_kmh to m/s", () => {
    const result = parseCsv(SAMPLE_CSV_SEMICOLON);
    // 4.32 km/h = 1.2 m/s
    expect(result.samples[0].speedMps).toBeCloseTo(1.2, 1);
  });

  it("parses tab-delimited CSV", () => {
    const result = parseCsv(SAMPLE_CSV_TAB);
    expect(result.samples).toHaveLength(2);
    expect(result.samples[0].lat).toBeCloseTo(5.36, 2);
  });

  it("handles Unix timestamps (seconds)", () => {
    const result = parseCsv(SAMPLE_CSV_UNIX_TS);
    expect(result.samples).toHaveLength(2);
    // Verify timestamps are valid dates
    expect(result.samples[0].ts).toBeInstanceOf(Date);
    expect(result.samples[0].ts.getTime()).toBeGreaterThan(0);
  });

  it("handles quoted values", () => {
    const result = parseCsv(SAMPLE_CSV_QUOTED);
    expect(result.samples).toHaveLength(2);
    expect(result.samples[0].lat).toBeCloseTo(5.36, 2);
  });

  it("returns error for missing lat/lon columns", () => {
    const result = parseCsv("name,value\ntest,123");
    expect(result.samples).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Colonnes latitude/longitude introuvables");
  });

  it("returns error for file with only header", () => {
    const result = parseCsv("lat,lon");
    expect(result.samples).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns error for empty file", () => {
    const result = parseCsv("");
    expect(result.samples).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("skips rows with invalid coordinates", () => {
    const csv = `lat,lon,time
5.36,-4.0083,2026-01-15T10:00:00Z
999,-4.0073,2026-01-15T10:00:05Z
5.38,-4.0063,2026-01-15T10:00:10Z`;
    const result = parseCsv(csv);
    expect(result.samples).toHaveLength(2);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("sorts samples by timestamp", () => {
    const csv = `lat,lon,time
5.36,-4.0083,2026-01-15T10:00:10Z
5.37,-4.0073,2026-01-15T10:00:00Z
5.38,-4.0063,2026-01-15T10:00:05Z`;
    const result = parseCsv(csv);
    for (let i = 1; i < result.samples.length; i++) {
      expect(result.samples[i].ts.getTime()).toBeGreaterThanOrEqual(
        result.samples[i - 1].ts.getTime()
      );
    }
  });

  it("trackName is always null for CSV", () => {
    const result = parseCsv(SAMPLE_CSV_COMMA);
    expect(result.trackName).toBeNull();
  });
});

// ── parseGpsFile Dispatcher Tests ──────────────────────────────────────────

describe("parseGpsFile (dispatcher)", () => {
  it("dispatches .gpx files to GPX parser", () => {
    const result = parseGpsFile(SAMPLE_GPX, "track.gpx");
    expect(result.format).toBe("GPX");
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it("dispatches .kml files to KML parser", () => {
    const result = parseGpsFile(SAMPLE_KML_LINESTRING, "route.kml");
    expect(result.format).toBe("KML");
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it("dispatches .csv files to CSV parser", () => {
    const result = parseGpsFile(SAMPLE_CSV_COMMA, "data.csv");
    expect(result.format).toBe("CSV");
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it("dispatches .tsv files to CSV parser", () => {
    const result = parseGpsFile(SAMPLE_CSV_TAB, "data.tsv");
    expect(result.format).toBe("CSV");
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it("dispatches .txt files to CSV parser", () => {
    const result = parseGpsFile(SAMPLE_CSV_COMMA, "data.txt");
    expect(result.format).toBe("CSV");
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it("auto-detects GPX content for unknown extensions", () => {
    const result = parseGpsFile(SAMPLE_GPX, "track.dat");
    expect(result.format).toBe("GPX");
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it("auto-detects KML content for unknown extensions", () => {
    const result = parseGpsFile(SAMPLE_KML_LINESTRING, "route.dat");
    expect(result.format).toBe("KML");
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it("falls back to CSV for unknown content", () => {
    const result = parseGpsFile(SAMPLE_CSV_COMMA, "data.dat");
    expect(result.format).toBe("CSV");
  });

  it("handles case-insensitive extensions", () => {
    const result = parseGpsFile(SAMPLE_GPX, "Track.GPX");
    expect(result.format).toBe("GPX");
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it("all parsed samples have required fields", () => {
    const result = parseGpsFile(SAMPLE_GPX, "track.gpx");
    for (const s of result.samples) {
      expect(typeof s.lat).toBe("number");
      expect(typeof s.lon).toBe("number");
      expect(s.ts).toBeInstanceOf(Date);
      expect(s.lat).toBeGreaterThanOrEqual(-90);
      expect(s.lat).toBeLessThanOrEqual(90);
      expect(s.lon).toBeGreaterThanOrEqual(-180);
      expect(s.lon).toBeLessThanOrEqual(180);
    }
  });
});

// ── Edge Cases ─────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("GPX: handles large number of points", () => {
    let points = "";
    for (let i = 0; i < 1000; i++) {
      const lat = 5.36 + i * 0.0001;
      const lon = -4.0083 + i * 0.0001;
      const time = new Date(Date.UTC(2026, 0, 15, 10, 0, i)).toISOString();
      points += `<trkpt lat="${lat}" lon="${lon}"><time>${time}</time></trkpt>\n`;
    }
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>${points}</trkseg></trk></gpx>`;
    const result = parseGpx(gpx);
    expect(result.samples).toHaveLength(1000);
  });

  it("CSV: handles Windows-style line endings (CRLF)", () => {
    const csv = "lat,lon,time\r\n5.36,-4.0083,2026-01-15T10:00:00Z\r\n5.37,-4.0073,2026-01-15T10:00:05Z";
    const result = parseCsv(csv);
    expect(result.samples).toHaveLength(2);
  });

  it("CSV: handles extra whitespace in values", () => {
    const csv = "lat , lon , time\n 5.36 , -4.0083 , 2026-01-15T10:00:00Z ";
    const result = parseCsv(csv);
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].lat).toBeCloseTo(5.36, 2);
  });

  it("KML: handles empty coordinates string", () => {
    const kml = `<?xml version="1.0"?>
    <kml><Document><Placemark><LineString><coordinates></coordinates></LineString></Placemark></Document></kml>`;
    const result = parseKml(kml);
    expect(result.samples).toHaveLength(0);
  });

  it("GPX: handles empty trkseg", () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg></trkseg></trk></gpx>`;
    const result = parseGpx(gpx);
    expect(result.samples).toHaveLength(0);
    expect(result.errors).toContain("Aucun point GPS valide trouvé dans le fichier GPX");
  });

  it("ParseResult always has format, trackName, errors, and samples", () => {
    const results: ParseResult[] = [
      parseGpx(SAMPLE_GPX),
      parseKml(SAMPLE_KML_LINESTRING),
      parseCsv(SAMPLE_CSV_COMMA),
    ];
    for (const r of results) {
      expect(r).toHaveProperty("format");
      expect(r).toHaveProperty("trackName");
      expect(r).toHaveProperty("errors");
      expect(r).toHaveProperty("samples");
      expect(Array.isArray(r.samples)).toBe(true);
      expect(Array.isArray(r.errors)).toBe(true);
    }
  });
});
