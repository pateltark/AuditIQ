import os
import json
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from docling.document_converter import DocumentConverter
from groq import Groq
from dotenv import load_dotenv  # <--- 1. Import dotenv

# Load environment variables from a .env file in the same directory
load_dotenv()

# ==========================================
# 1. STANDARDIZED PYDANTIC SCHEMAS
# ==========================================

class LineItem(BaseModel):
    description: str = Field(description="Description of the service or item, e.g., 'Deep Cleaning - Apt 4B'")
    service_date: Optional[str] = Field(None, description="Date the service was performed (YYYY-MM-DD if available)")
    quantity: Optional[float] = Field(1.0, description="Quantity or hours")
    unit_price: Optional[float] = Field(None, description="Price per unit")
    total: float = Field(description="Total line amount")

class UniversalInvoice(BaseModel):
    supplier_name: str = Field(description="Name of the vendor/supplier issuing the invoice")
    invoice_number: Optional[str] = Field(description="Invoice ID or number")
    invoice_date: Optional[str] = Field(description="Date the invoice was issued (YYYY-MM-DD)")
    currency: str = Field(description="Currency code like USD, AED, EUR")
    total_amount: float = Field(description="Grand total of the invoice")
    items: List[LineItem]


# ==========================================
# 2. PDF PARSING & LLM EXTRACTION PIPELINE
# ==========================================

class InvoiceExtractorPipeline:
    def __init__(self):
        # Initialize Docling converter for universal PDF ingestion
        self.converter = DocumentConverter()
        # Initialize Groq client
        self.groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    def convert_pdf_to_markdown(self, pdf_path: str) -> str:
        """Converts any PDF layout into structured markdown using Docling."""
        print(f"[*] Processing PDF layout with Docling: {pdf_path}")
        result = self.converter.convert(pdf_path)
        return result.document.export_to_markdown()

    def extract_structured_data(self, markdown_text: str) -> UniversalInvoice:
        """Sends layout markdown to Groq to extract clean, standardized JSON matching our schema."""
        print("[*] Extracting structured entities via LLM...")
        
        # We prompt the LLM to output valid JSON matching our schema fields
        schema_json_str = json.dumps(UniversalInvoice.model_json_schema(), indent=2)
        
        prompt = f"""
You are an expert invoice data extractor. Extract the invoice details from the markdown below into strict JSON format matching this JSON schema:

{schema_json_str}

Markdown Content:
{markdown_text}
"""

        completion = self.groq_client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": "You extract invoice data accurately into JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )

        raw_json_output = completion.choices[0].message.content
        parsed_data = json.loads(raw_json_output)
        
        return UniversalInvoice(**parsed_data)


# ==========================================
# 3. RECONCILIATION / DISCREPANCY ENGINE
# ==========================================

class BookingReconciler:
    @staticmethod
    def audit_cleaning_invoice(invoice: UniversalInvoice, mock_booking_dates: List[str]) -> List[str]:
        """
        Cross-checks invoice line items against actual property booking dates.
        mock_booking_dates would normally come from your Airbnb iCal or database query.
        """
        discrepancies = []
        print(f"\n[*] Auditing Invoice {invoice.invoice_number} from {invoice.supplier_name}...")
        
        for item in invoice.items:
            # If the invoice line item specifies a service date, check if a guest stayed that night
            if item.service_date:
                if item.service_date not in mock_booking_dates:
                    discrepancies.append(
                        f"[FLAG] Billed cleaning on {item.service_date} for '{item.description}' "
                        f"({invoice.currency} {item.total}), but NO matching booking was found in the calendar!"
                    )
                else:
                    print(f"[PASS] Verified booking for date: {item.service_date}")
            else:
                discrepancies.append(
                    f"[WARNING] Line item '{item.description}' has no explicit service date to cross-check."
                )
                
        return discrepancies


# ==========================================
# 4. EXECUTION FLOW
# ==========================================

if __name__ == "__main__":
    # Path to your messy supplier or cleaning invoice PDF
    pdf_file_path = "invoice.pdf" 
    
    if not os.path.exists(pdf_file_path):
        print(f"Error: {pdf_file_path} not found. Place a sample PDF in the directory to run.")
    else:
        # Initialize pipeline
        pipeline = InvoiceExtractorPipeline()
        
        # Step 1: Docling extracts layout text/markdown from the arbitrary PDF
        markdown_doc = pipeline.convert_pdf_to_markdown(pdf_file_path)
        
        # Step 2: LLM normalizes the messy text into our clean Pydantic model
        structured_invoice = pipeline.extract_structured_data(markdown_doc)
        
        print("\n--- Successfully Normalized Invoice Data ---")
        print(json.dumps(structured_invoice.model_dump(), indent=2))
        
        # Step 3: Cross-reference with your operational system (e.g., Airbnb calendar data)
        # In production, query your database or iCal feed for actual guest check-out/stay dates
        simulated_calendar_bookings = ["2026-07-30", "2026-07-31", "2026-08-01"]
        
        flags = BookingReconciler.audit_cleaning_invoice(structured_invoice, simulated_calendar_bookings)
        
        print("\n--- Audit Results & Discrepancies ---")
        if flags:
            for flag in flags:
                print(flag)
        else:
            print("All line items successfully matched your booking calendar!")