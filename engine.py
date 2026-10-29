import os
import json
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
# 1. AIRBNB iCAL CALENDAR PARSER
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
        raw = os.environ.get("AIRBNB_ICAL_URLS", "")
        feeds = {}
        for part in raw.split(";"):
            part = part.strip()
            if "=" in part:
                name, url = part.split("=", 1)
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
            if "not available" in summary.lower():
                continue
            start = self._to_date(event.get("DTSTART").dt)
            end = self._to_date(event.get("DTEND").dt)
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
            print(f"  [cal] Fetch failed, using cached data: {e}")

    def valid_dates(self, property_name: Optional[str] = None) -> List[str]:
        """Dates (YYYY-MM-DD) a service could legitimately happen."""
        self.refresh()
        dates: Set[str] = set()
        for b in self._bookings:
            if property_name and b["property"] != property_name:
                continue
            d = b["checkin"]
            while d < b["checkout"]:
                dates.add(d.isoformat())
                d += timedelta(days=1)
            if self.include_checkout_day:
                dates.add(b["checkout"].isoformat())
        return sorted(dates)


# ==========================================
# 2. STANDARDIZED PYDANTIC SCHEMAS
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
# 3. DATE NORMALIZER
# ==========================================

_DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%d %b %Y",
                 "%d %B %Y", "%b %d, %Y", "%B %d, %Y", "%m/%d/%Y"]


def normalize_date(value: Optional[str]) -> Optional[str]:
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
# 4. DOCLING & GROQ PROCESSING SERVICE
# ==========================================

class InvoiceWatcherService:
    def __init__(self):
        self.converter = DocumentConverter()
        self.groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    def extract_invoice_data(self, pdf_path: Path) -> UniversalInvoice:
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
- If the year is missing, assume the invoice's year.
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

        invoice.invoice_date = normalize_date(invoice.invoice_date)
        for item in invoice.items:
            item.service_date = normalize_date(item.service_date)
        return invoice

    def audit_invoice(self, invoice: UniversalInvoice, valid_booking_dates: List[str]) -> List[str]:
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