"""Import the reviewed prospect archive without overwriting an existing contact file.

Requires PyMuPDF (fitz). Run from the workspace root. Source PDFs stay unchanged.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

import fitz


def parse_report(path):
    leads, contests = [], []
    current, field, year = None, None, None
    labels = {
        "CONTACT": "contact", "EMAIL": "email", "RELATIONSHIP": "relationship",
        "OPPORTUNITY": "opportunity", "WEBSITE": "website", "WEBSITE STATUS": "website_status",
        "LAST CONTACT": "last_contact", "NEXT ACTION": "next_action", "GMAIL THREAD": "gmail_thread",
        "WEBSITE EVIDENCE": "website_evidence", "NOTES": "notes", "YEAR": "year",
        "CONTEST ID": "contest_id", "FILES ACCEPTED": "files_accepted", "RESULT": "result",
        "PRIZE": "prize", "COMPANY STATUS": "company_status", "99DESIGNS CONTEST": "contest_url",
        "GMAIL EVIDENCE": "gmail_thread", "RESEARCH NEXT STEP": "next_action",
    }
    with fitz.open(path) as document:
        for page_number, page in enumerate(document, 1):
            if page_number < 4 or page_number > 73:
                continue
            kind = "lead" if page_number < 68 else "contest"
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    spans = line["spans"]
                    first = spans[0]
                    if first["bbox"][1] > 800:
                        continue  # Page footer, emitted first by this PDF.
                    text = "".join(span["text"] for span in spans).strip()
                    size = first["size"]
                    if abs(size - 20) < .1:
                        match = re.match(r"(20\d\d)\s*/", text)
                        if match:
                            year = match[1]
                        continue
                    if abs(size - 11.5) < .1:
                        match = re.match(r"^(\d{3} |\d{2} )(.+)", text)
                        if match:
                            current = {"source_index": int(match[1]), "name": match[2], "source_pages": [page_number]}
                            if kind == "lead":
                                current["year"] = year
                                leads.append(current)
                            else:
                                contests.append(current)
                            field = None
                        elif current:
                            current["name"] += " " + text
                        continue
                    if current is None:
                        continue
                    if page_number not in current["source_pages"]:
                        current["source_pages"].append(page_number)
                    if abs(size - 7.6) < .02 and kind == "lead" and first["bbox"][0] > 450:
                        current["priority"] = text.lower()
                        continue
                    if first["font"].endswith("-Bold") and text in labels:
                        field = labels[text]
                        current[field] = ""
                    elif field and first["bbox"][0] >= 165:
                        join = "" if field in ("website", "website_evidence", "gmail_thread", "contest_url") else " "
                        current[field] = (current[field] + join + text).strip()
    assert len(leads) == 179, f"Expected 179 lead records, found {len(leads)}"
    assert len(contests) == 19, f"Expected 19 contest entries, found {len(contests)}"
    assert [x["source_index"] for x in leads] == list(range(1, 180))
    assert [x["source_index"] for x in contests] == list(range(1, 20))
    assert Counter(x["year"] for x in leads) == {
        "2026": 11, "2025": 11, "2024": 6, "2023": 8, "2022": 14, "2021": 20,
        "2020": 28, "2019": 22, "2018": 17, "2017": 10, "2016": 20, "2015": 7, "2014": 5,
    }
    for item in leads:
        assert item.get("priority") in ("high", "medium", "low", "review", "existing"), item
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", item.get("last_contact", "")), item
    return leads, contests


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("admin/.data/marketing.json"))
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit("The destination already exists. Choose another --output to protect saved edits.")
    report = Path("Business_Prospects_2013-2026_Readable_Report.pdf")
    tracker = Path("Business Prospects 2013-2026 - Client Tracker (1).pdf")
    leads, contests = parse_report(report)
    # Verify that the original combined tab corroborates all record dates and
    # each contest ID. Its narrow columns truncate text, so import full report text.
    with fitz.open(tracker) as source:
        combined = source[0].get_text()
        contest_tab = source[7].get_text()
        assert len(re.findall(r"(?m)^20\d\d$", combined)) == 179
        assert all(item["last_contact"] in combined for item in leads)
        assert all(not item.get("contest_id") or item["contest_id"] in contest_tab for item in contests)
        # The compressed original export merges adjacent text spans. Recover
        # cells by character coordinates to verify each row independently.
        columns = [50.86, 62.41, 95.26, 128.10, 167.02, 226.32, 257.65,
                   288.97, 327.90, 366.82, 385.22, 429.47, 473.71, 517.96, 561.0]
        table_rows = defaultdict(lambda: [""] * 14)
        for block in source[0].get_text("rawdict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    for char in span["chars"]:
                        x, y = char["bbox"][:2]
                        cell = next((i for i in range(14) if columns[i] - .015 <= x < columns[i + 1] - .015), None)
                        if cell is not None:
                            table_rows[round(y, 2)][cell] += char["c"]
        original_rows = [cells for _, cells in sorted(table_rows.items()) if re.fullmatch(r"20\d{2}", cells[0].strip())]
        assert len(original_rows) == len(leads)
        for original, lead in zip(original_rows, leads):
            assert original[0].strip() == lead["year"], lead["source_index"]
            assert original[6].strip().lower() == lead["priority"], lead["source_index"]
            assert original[9].strip() == lead["last_contact"], lead["source_index"]
            assert lead["name"].startswith(original[1].strip()[:20]), lead["source_index"]

    records = []
    # Exact names identify repeated yearly entries. Different businesses sharing
    # a person/email remain separate; their original history stays attached.
    by_name = {}
    editable = ("name", "contact", "email", "relationship", "opportunity", "priority", "website",
                "website_status", "last_contact", "next_action", "gmail_thread", "website_evidence", "notes")
    for item in leads:
        key = item["name"].casefold().strip()
        if key not in by_name:
            row = {name: item.get(name, "") for name in editable}
            row.update(id=f"prospect-{item['source_index']:03}", version=1, year=item["year"],
                       phone="", stage="to-review", payment_status="unknown", payment_notes="",
                       follow_up="", history=[], contests=[], kind="lead", created_at="2026-10-31T00:00:00.000Z",
                       updated_at="2026-10-31T00:00:00.000Z")
            by_name[key] = row
            records.append(row)
        by_name[key]["history"].append(item)
    for contest in contests:
        matches = [row for row in records if any(
            (contest.get("contest_id") and re.search(r"(?<!\d)" + re.escape(contest["contest_id"]) + r"(?!\d)", json.dumps(item)))
            or (contest.get("gmail_thread") and contest["gmail_thread"] == item.get("gmail_thread"))
            for item in row["history"])]
        # These two use different source emails for the same explicitly named
        # project. The third unmatched entry is a platform award, not a client.
        explicit_matches = {5: "The Forum / A.K. Hospitality (Pattaya)", 19: "Element Chiropractic Wellness"}
        if not matches and contest["source_index"] in explicit_matches:
            matches = [by_name[explicit_matches[contest["source_index"]].casefold()]]
        assert len(matches) == 1 or contest["source_index"] == 7, (contest["name"], matches)
        contest["lead_id"] = matches[0]["id"] if matches else ""
        if matches:
            matches[0]["contests"].append(contest)
    # Classifications reviewed against the actual Relationship/Notes fields.
    # A quoted fee or an expected contest prize never becomes received money.
    payment_groups = {
        "paid": [13, 16, 30, 32, 37, 39, 43, 69, 75, 77, 79, 102, 121, 138, 139, 151, 170, 176],
        "deposit": [12, 31, 78],
        "unresolved": [19, 41, 54, 85, 106, 118],
        "quoted": [14, 23, 24, 26, 27, 35, 44, 45, 55, 57, 59, 60, 71, 74, 94, 95, 96, 103,
                   104, 110, 113, 116, 117, 122, 123, 131, 133, 146, 147, 149, 150, 155],
        "prize": [42, 98, 119, 125, 126, 127, 143, 157, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168],
    }
    for status, indices in payment_groups.items():
        for index in indices:
            row = records[index - 1]
            assert row["id"] == f"prospect-{index:03}"
            row["payment_status"] = status
            row["payment_notes"] = row["relationship"] + ". " + row["notes"]
    # Preserve the earlier year-tab wording explicitly documented on report p74.
    by_name["unidentified website lead: evin"]["history"][0]["original_year_tab_notes"] = (
        "Only outgoing website proposal established; cannot confirm a live business.")
    data = {"schema_version": 1, "imported_at": datetime.now(timezone.utc).isoformat(),
            "sources": [{"file": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                        for path in (report, tracker)],
            "import_summary": {"lead_records": 179, "contest_entries": 19, "contacts": len(records),
                               "coverage": "2014-2026; no corroborated 2013 records in the source archive."},
            "contest_history": contests, "records": records, "activity": []}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as destination:
        json.dump(data, destination, ensure_ascii=False, indent=2)
        destination.write("\n")
    print(json.dumps({"output": str(args.output), "contacts": len(records), "lead_records": 179,
                      "contest_entries": 19, "priorities": dict(Counter(r["priority"] for r in records))}))


if __name__ == "__main__":
    main()
