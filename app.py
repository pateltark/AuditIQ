import os
import json
import shutil
import time
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv, set_key
from engine import BookingCalendar, InvoiceWatcherService

load_dotenv()

app = FastAPI(
    title="ReconFlow API",
    description="Automated document reconciliation and audit engine API for short-term rentals.",
    version="1.1.0"
)

# ==========================================
# 1. CORS MIDDLEWARE (ENABLE FRONTEND ACCESS)
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# 2. DIRECTORIES & INITIALIZATION
# ==========================================

BASE_DIR = Path(__file__).parent
INBOX_DIR = BASE_DIR / "inbox"
PROCESSED_DIR = BASE_DIR / "processed"
FLAGGED_DIR = BASE_DIR / "flagged"
REPORTS_DIR = BASE_DIR / "reports"
ENV_FILE = BASE_DIR / ".env"

for folder in [INBOX_DIR, PROCESSED_DIR, FLAGGED_DIR, REPORTS_DIR]:
    folder.mkdir(exist_ok=True)

# Initialize engine services
service = InvoiceWatcherService()

try:
    calendar = BookingCalendar.from_env()
    calendar.refresh(force=True)
except Exception as e:
    print(f"[-] Warning initializing calendar feeds: {e}")
    calendar = None


# ==========================================
# 3. REQUEST / RESPONSE SCHEMAS
# ==========================================

class CalendarConfigUpdate(BaseModel):
    listing_name: str
    ical_url: str


# ==========================================
# 4. API ENDPOINTS
# ==========================================

@app.get("/")
def home():
    return {
        "status": "online",
        "message": "Audit Engine API is active. Go to /docs for interactive Swagger UI testing."
    }


@app.post("/audit-invoice/")
async def audit_invoice_endpoint(file: UploadFile = File(...)):
    """
    Upload a cleaning invoice PDF. The API will parse it via Docling,
    fetch the latest iCal dates, cross-check for discrepancies, and return the audit report.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF document files are supported.")

    # Save uploaded file temporarily to inbox
    temp_pdf_path = INBOX_DIR / file.filename
    try:
        with open(temp_pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Fetch latest iCal dates on-demand
        valid_dates = calendar.valid_dates() if calendar else []

        # Parse invoice data via Docling & Groq
        invoice_data = service.extract_invoice_data(temp_pdf_path)

        # Audit line items against booking calendar
        flags = service.audit_invoice(invoice_data, valid_dates)

        # Save JSON report
        status = "FLAGGED" if flags else "PASSED"
        report_data = {
            "file_name": file.filename,
            "processed_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "status": status,
            "invoice": invoice_data.model_dump(),
            "discrepancies": flags,
        }
        report_file = REPORTS_DIR / f"{temp_pdf_path.stem}_report.json"
        report_file.write_text(json.dumps(report_data, indent=2), encoding="utf-8")

        # Route file to processed or flagged folder
        dest_dir = FLAGGED_DIR if flags else PROCESSED_DIR
        target_path = dest_dir / file.filename
        if target_path.exists():
            target_path = dest_dir / f"{temp_pdf_path.stem}_{int(time.time())}{temp_pdf_path.suffix}"
        
        shutil.move(str(temp_pdf_path), str(target_path))

        return {
            "status": status,
            "file_name": file.filename,
            "routed_to": str(target_path.relative_to(BASE_DIR)),
            "invoice_summary": invoice_data.model_dump(),
            "discrepancies": flags
        }

    except Exception as e:
        if temp_pdf_path.exists():
            temp_pdf_path.unlink()
        raise HTTPException(status_code=500, detail=f"Pipeline processing error: {str(e)}")


@app.get("/api/folders/")
def list_folder_contents():
    """
    Returns files currently stored across inbox, processed, flagged, and reports directories.
    """
    return {
        "inbox": [f.name for f in INBOX_DIR.glob("*.pdf")],
        "processed": [f.name for f in PROCESSED_DIR.glob("*.pdf")],
        "flagged": [f.name for f in FLAGGED_DIR.glob("*.pdf")],
        "reports": [f.name for f in REPORTS_DIR.glob("*.json")],
    }


@app.get("/api/reports/{filename}")
def get_report_detail(filename: str):
    """
    Retrieves the detailed JSON audit report for a specific document.
    """
    if not filename.endswith(".json"):
        filename += "_report.json"

    report_file = REPORTS_DIR / filename
    if not report_file.exists():
        raise HTTPException(status_code=404, detail=f"Report file '{filename}' not found.")
    
    return json.loads(report_file.read_text(encoding="utf-8"))


@app.post("/api/calendar/config/")
def update_calendar_config(config: CalendarConfigUpdate):
    """
    Update or add an iCal URL for a property listing and reload calendar feeds in memory.
    """
    global calendar
    try:
        current_env_val = os.environ.get("AIRBNB_ICAL_URLS", "")
        new_entry = f"{config.listing_name}={config.ical_url}"

        if not current_env_val:
            updated_val = new_entry
        elif config.listing_name in current_env_val:
            # Replace existing property URL entry
            parts = [p.strip() for p in current_env_val.split(";") if p.strip()]
            new_parts = []
            for p in parts:
                if "=" in p and p.split("=", 1)[0].strip() == config.listing_name:
                    new_parts.append(new_entry)
                else:
                    new_parts.append(p)
            updated_val = ";".join(new_parts)
        else:
            updated_val = f"{current_env_val};{new_entry}"

        # Update environment variable and save to .env
        os.environ["AIRBNB_ICAL_URLS"] = updated_val
        if ENV_FILE.exists():
            set_key(str(ENV_FILE), "AIRBNB_ICAL_URLS", updated_val)

        # Refresh calendar instance
        calendar = BookingCalendar.from_env()
        calendar.refresh(force=True)

        return {
            "status": "success",
            "message": f"Updated calendar config for '{config.listing_name}'",
            "active_dates_count": len(calendar.valid_dates())
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update calendar configuration: {str(e)}")