import os
import json
import shutil
import time
from pathlib import Path

from dotenv import load_dotenv
from engine import BookingCalendar, InvoiceWatcherService, UniversalInvoice

load_dotenv()

# ==========================================
# DIRECTORY CONFIGURATION
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

    # Triggered when files arrive in inbox: Fetches/refreshes iCal data[cite: 1]
    valid_dates = calendar.valid_dates()  
    print("\n==========================================")
    print(f" Found {len(pdf_files)} PDF(s) in inbox. Processing batch...")
    print(f" Calendar has {len(valid_dates)} valid date(s).")
    print("==========================================")

    for pdf_path in pdf_files:
        print(f"\n Processing: {pdf_path.name}")
        try:
            # Step 1: Parse PDF layout via Docling & extract via Groq
            invoice_data = service.extract_invoice_data(pdf_path)

            # Step 2: Audit against booking calendar dates
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
    
    # Initialize iCal calendar connection from .env
    calendar = BookingCalendar.from_env()  
    calendar.refresh(force=True)

    print("Starting Watcher loop. Drop PDFs into the 'inbox' folder (Press Ctrl+C to stop)...")
    try:
        while True:
            process_inbox(service, calendar)
            time.sleep(3)  # Poll inbox every 3 seconds
    except KeyboardInterrupt:
        print("\nWatcher stopped cleanly.")