"""Build the Texas search directory from GeoNames, without a hand-maintained list.

Uses only Python's standard library. Downloads public geographic data; no business
records, credentials or application databases are read or written.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import tempfile
import shutil
import subprocess
import re
from datetime import datetime, timezone
import urllib.request
import zipfile

BASE = "https://download.geonames.org/export/dump/"
ROOT = Path(__file__).resolve().parents[1]


def download(name, destination):
    print(f"Downloading GeoNames {name}...", flush=True)
    # Windows' native curl handles the system's network setup more reliably.
    if shutil.which("curl.exe"):
        common = ["curl.exe", "--fail", "--silent", "--show-error", "--connect-timeout", "20", "--max-time", "120"]
        if name == "US.zip":
            headers = subprocess.run(common + ["--head", BASE + name], check=True, capture_output=True, text=True).stdout
            size = int(re.search(r"(?im)^Content-Length:\s*(\d+)", headers).group(1))
            with destination.open("wb") as output:
                for start in range(0, size, 8 * 1024 * 1024):
                    end = min(start + 8 * 1024 * 1024, size) - 1
                    part = destination.with_suffix(".part")
                    try:
                        subprocess.run(common + ["--retry", "2", "--range", f"{start}-{end}", "--output", str(part), BASE + name], check=True)
                        if part.stat().st_size != end - start + 1:
                            raise ValueError("Unexpected download range size")
                        with part.open("rb") as source:
                            shutil.copyfileobj(source, output)
                    finally:
                        part.unlink(missing_ok=True)
                    print(f"Downloaded {end + 1:,} / {size:,} bytes", flush=True)
        else:
            subprocess.run(common + ["--output", str(destination), BASE + name], check=True)
        return hashlib.sha256(destination.read_bytes()).hexdigest()
    request = urllib.request.Request(BASE + name, headers={"User-Agent": "WebsiteProducts-LocationImport/1.0"})
    with urllib.request.urlopen(request, timeout=180) as response, destination.open("wb") as output:
        while chunk := response.read(64 * 1024):
            output.write(chunk)
    return hashlib.sha256(destination.read_bytes()).hexdigest()


def build(country_path, counties_path):
    counties = {}
    for line in counties_path.read_text(encoding="utf-8").splitlines():
        values = line.split("\t")
        if values[0].startswith("US.TX."):
            counties[values[0]] = values[1]
    if len(counties) != 254:
        raise ValueError(f"Expected all 254 Texas counties, received {len(counties)}")
    places = []
    with zipfile.ZipFile(country_path) as archive, archive.open("US.txt") as raw:
        for row in csv.reader(io.TextIOWrapper(raw, encoding="utf-8"), delimiter="\t"):
            if len(row) != 19 or row[8] != "US" or row[10] != "TX" or row[6] != "P":
                continue
            # Exclude historical, abandoned and destroyed places.
            if row[7] in {"PPLH", "PPLQ", "PPLW"}:
                continue
            county = counties.get("US.TX." + row[11])
            if not county:
                continue  # Do not guess an unidentified county.
            places.append({"id": "geonames-" + row[0], "name": row[1], "county": county,
                           "latitude": float(row[4]), "longitude": float(row[5]),
                           "feature_code": row[7], "population": int(row[14] or 0),
                           "aliases": list(dict.fromkeys([row[2]] + row[3].split(",")))[:30]})
    if len(places) < 1500 or len({row["id"] for row in places}) != len(places):
        raise ValueError("Unexpected or duplicate Texas location data; no output written")
    return sorted(places, key=lambda row: (row["name"].casefold(), row["county"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "texas-locations.json")
    parser.add_argument("--source-dir", type=Path, help="Reuse a local US.zip and admin2Codes.txt (download any missing file)")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="texas-geonames-") as temp:
        directory = args.source_dir or Path(temp)
        directory.mkdir(parents=True, exist_ok=True)
        hashes = {name: hashlib.sha256((directory / name).read_bytes()).hexdigest() if (directory / name).exists() else download(name, directory / name) for name in ["US.zip", "admin2Codes.txt"]}
        places = build(directory / "US.zip", directory / "admin2Codes.txt")
    data = {"schema_version": 1, "state": "Texas", "state_code": "TX", "source": "GeoNames",
            "source_url": BASE, "license": "CC BY 4.0", "attribution": "GeoNames (geonames.org), CC BY 4.0",
            "imported_at": datetime.now(timezone.utc).isoformat(), "source_sha256": hashes,
            "coverage": "Current populated places, including cities, towns, CDPs and smaller communities where recorded. County is the primary GeoNames county. Legal incorporation status is not inferred. Coverage is not guaranteed complete.",
            "locations": places}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(args.output)
    print(f"Imported {len(places):,} Texas locations from GeoNames into {args.output}")


if __name__ == "__main__":
    main()
