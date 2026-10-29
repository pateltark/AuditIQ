import os
import json
import shutil
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Set

import requests
from dotenv import load_dotenv
from docling.document_converter import DocumentConverter
from groq import Groq
from icalendar import Calendar
from pydantic import BaseModel, Field

load_dotenv()

# ==========================================
# 1. DIRECTORY CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).parent
INBOX_DIR = BASE_DIR / "inbox"
PROCESSED_DIR = BASE_DIR / "processed"
FLAGGED_DIR = BASE_DIR / "flagged"
REPORTS_DIR = BASE_DIR / "reports"


def setup_directories():
    """Ensure all required folders exist."""
    for folder in [INBOX_DIR, PROCESSED_DIR, FLAGGED_DIR, REPORTS_DIR]:
        folder.mkdir(exist_ok=True)
    print("[*] Directories initialized:")
    print(f"    - Drop PDFs here: {INBOX_DIR}")
    print(f"    - Clean files go to: {PROCESSED_DIR}")
    print(f"    - Discrepancies go to: {FLAGGED_DIR}\n")


# ==========================================
# 2. AIRBNB iCAL CALENDAR
# ==========================================

class BookingCalendar:
    """Fetches Airbnb iCal feeds and exposes valid dates for invoice auditing."""

    def __init__(self, feeds: Dict[str, str], include_checkout_day: bool = True,
                 ttl_seconds: int = 900):
        self.feeds = feeds
        self.include_checkout_day = include_checkout_day
        self.ttl = ttl_seconds
        self._last_fetch = 0.0
        self._bookings: List[dict] = []

    @classmethod
    def from_env(cls, **kwargs) -> "BookingCalendar":
        # Format: AIRBNB_ICAL_URLS=Name1=https://...ics;Name2=https://...ics
        raw = os.environ.get("AIRBNB_ICAL_URLS", "")
        feeds = {}
        for part in raw.split(";"):
            part = part.strip()
            if "=" in part:
                name, url = part.split("=", 1)  # split on first '=' only
                feeds[name.strip()] = url.strip()
        if not feeds:
            raise RuntimeError("Set AIRBNB_ICAL_URLS in .env (Name=URL;Name2=URL2)")
        return cls(feeds, **kwargs)

    @staticmethod
    def _to_date(value) -> date:
        return value.date() if isinstance(value, datetime) else value

    def _fetch_feed(self, prop_name: str, url: str) -> List[dict]:
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        cal = Calendar.from_ical(resp.content)

        bookings = []
        for event in cal.walk("VEVENT"):
            summary = str(event.get("SUMMARY", ""))
            # Airbnb uses "Reserved" for real stays; "(Not available)" = manual blocks
            if "not available" in summary.lower():
                continue
            start = self._to_date(event.get("DTSTART").dt)
            end = self._to_date(event.get("DTEND").dt)  # checkout day (exclusive)
            bookings.append({
                "property": prop_name,
                "checkin": start,
                "checkout": end,
                "summary": summary,
                "uid": str(event.get("UID", "")),
            })
        return bookings

    def refresh(self, force: bool = False) -> None:
        if not force and self._bookings and (time.time() - self._last_fetch) < self.ttl:
            return
        all_bookings = []
        try:
            for name, url in self.feeds.items():
                found = self._fetch_feed(name, url)
                print(f"  [cal] {name}: {len(found)} reservation(s)")
                all_bookings.extend(found)
            self._bookings = all_bookings
            self._last_fetch = time.time()
        except Exception as e:
            # Keep the last good data instead of breaking the watcher
            print(f"  [cal] Fetch failed, using cached data: {e}")

    def valid_dates(self, property_name: Optional[str] = None) -> List[str]:
        """Dates (YYYY-MM-DD) a service could legitimately happen."""
        self.refresh()
        dates: Set[str] = set()
        for b in self._bookings:
            if property_name and b["property"] != property_name:
                continue
            d = b["checkin"]
            while d < b["checkout"]:  # each night stayed
                dates.add(d.isoformat())
                d += timedelta(days=1)
            if self.include_checkout_day:  # cleaners usually come on turnover day
                dates.add(b["checkout"].isoformat())
        return sorted(dates)


# ==========================================
# 3. STANDARDIZED PYDANTIC SCHEMAS
# ==========================================

class LineItem(BaseModel):
    description: str = Field(description="Description of item/service")
    service_date: Optional[str] = Field(None, description="Date service performed (YYYY-MM-DD)")
    quantity: Optional[float] = Field(1.0, description="Quantity or hours")
    unit_price: Optional[float] = Field(None, description="Price per unit")
    total: float = Field(description="Total line amount")


class UniversalInvoice(BaseModel):
    supplier_name: str = Field(description="Name of vendor/supplier")
    invoice_number: Optional[str] = Field(None, description="Invoice number")
    invoice_date: Optional[str] = Field(None, description="Issue date (YYYY-MM-DD)")
    currency: str = Field("AED", description="Currency code")
    total_amount: float = Field(description="Grand total")
    items: List[LineItem]


# ==========================================
# 4. DATE NORMALIZER (safety net for LLM output)
# ==========================================

_DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d %b %Y",
                 "%d %B %Y", "%b %d, %Y", "%B %d, %Y", "%m/%d/%Y"]


def normalize_date(value: Optional[str]) -> Optional[str]:
    """Best-effort conversion to YYYY-MM-DD. Returns the original if unparseable."""
    if not value:
        return None
    value = value.strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return value


# ==========================================
# 5. PARSING & AUDIT ENGINE
# ==========================================

class InvoiceWatcherService:
    def __init__(self):
        self.converter = DocumentConverter()
        self.groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    def extract_invoice_data(self, pdf_path: Path) -> UniversalInvoice:
        """Converts PDF with Docling and extracts structured JSON via Groq."""
        print(f"  [+] Docling reading layout: {pdf_path.name}")
        result = self.converter.convert(str(pdf_path))
        markdown_text = result.document.export_to_markdown()

        print("  [+] Extracting JSON via Groq...")
        schema_json_str = json.dumps(UniversalInvoice.model_json_schema(), indent=2)
        prompt = f"""
Extract invoice details from the markdown below into strict JSON matching this schema:

{schema_json_str}

Rules:
- All dates must be formatted YYYY-MM-DD.
- If the year is missing (e.g. "30/07" or "Jul 30"), assume the invoice's year.
- Use null for any field not present. Never guess.
- Return only the JSON object, no extra text.

Document Markdown Content:
{markdown_text}
"""
        completion = self.groq_client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": "Extract invoice data accurately into valid JSON."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )

        parsed_data = json.loads(completion.choices[0].message.content)
        invoice = UniversalInvoice(**parsed_data)

        # Safety net: force dates into YYYY-MM-DD
        invoice.invoice_date = normalize_date(invoice.invoice_date)
        for item in invoice.items:
            item.service_date = normalize_date(item.service_date)
        return invoice

    def audit_invoice(self, invoice: UniversalInvoice, valid_booking_dates: List[str]) -> List[str]:
        """Returns a list of discrepancy flag messages. Pure Python, no LLM."""
        valid = set(valid_booking_dates)
        flags = []
        for item in invoice.items:
            if item.service_date:
                if item.service_date not in valid:
                    flags.append(
                        f"UNMATCHED DATE: Service on '{item.service_date}' for '{item.description}' "
                        f"({invoice.currency} {item.total}) has no active guest booking!"
                    )
            else:
                flags.append(f"MISSING DATE: Line item '{item.description}' has no explicit date.")
        return flags


# ==========================================
# 6. BATCH WATCHER WORKFLOW
# ==========================================

def safe_move(src: Path, dest_dir: Path) -> Path:
    """Move file, avoiding overwrite if the name already exists."""
    target = dest_dir / src.name
    if target.exists():
        target = dest_dir / f"{src.stem}_{int(time.time())}{src.suffix}"
    shutil.move(str(src), str(target))
    return target


def process_inbox(service: InvoiceWatcherService, calendar: BookingCalendar):
    pdf_files = list(INBOX_DIR.glob("*.pdf"))
    if not pdf_files:
        return

    valid_dates = calendar.valid_dates()  # auto-refreshes every 15 min
    print("\n==========================================")
    print(f" Found {len(pdf_files)} PDF(s) in inbox. Processing batch...")
    print(f" Calendar has {len(valid_dates)} valid date(s).")
    print("==========================================")

    for pdf_path in pdf_files:
        print(f"\n Processing: {pdf_path.name}")
        try:
            # Step 1: Parse and normalize PDF
            invoice_data = service.extract_invoice_data(pdf_path)

            # Step 2: Audit against booking calendar
            flags = service.audit_invoice(invoice_data, valid_dates)

            # Step 3: Save audit report JSON
            report_data = {
                "file_name": pdf_path.name,
                "processed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "status": "FLAGGED" if flags else "PASSED",
                "invoice": invoice_data.model_dump(),
                "discrepancies": flags,
            }
            report_file = REPORTS_DIR / f"{pdf_path.stem}_report.json"
            report_file.write_text(json.dumps(report_data, indent=2), encoding="utf-8")

            # Step 4: Route file based on audit outcome
            if flags:
                print(f" [FLAGGED] {len(flags)} issue(s):")
                for f in flags:
                    print(f"    -> {f}")
                dest_dir = FLAGGED_DIR
            else:
                print(" [PASSED] All dates verified against booking calendar.")
                dest_dir = PROCESSED_DIR

            target_path = safe_move(pdf_path, dest_dir)
            print(f" -> Moved PDF to: {target_path.relative_to(BASE_DIR)}")

        except Exception as e:
            print(f" ERROR processing {pdf_path.name}: {e}")


if __name__ == "__main__":
    setup_directories()
    service = InvoiceWatcherService()
    calendar = BookingCalendar.from_env()  # include_checkout_day=True by default
    calendar.refresh(force=True)           # fail early/visibly if the URLs are wrong

    print("Starting Watcher loop. Drop PDFs into the 'inbox' folder (Press Ctrl+C to stop)...")
    try:
        while True:
            process_inbox(service, calendar)
            time.sleep(3)  # Poll inbox every 3 seconds
    except KeyboardInterrupt:
        print("\nWatcher stopped cleanly.")