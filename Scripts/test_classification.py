"""
Test script for document classification logic.
Run from project root: python -m Scripts.test_classification
"""
import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from Backend.Source.Services.AIService import ai_service
from pathlib import Path

# Use PyMuPDF for PDF extraction (already in requirements)
import fitz  # PyMuPDF

TEST_DIR = Path("C:/Users/hp/Desktop/Hekata/QiyasAI/Data/Test")

# Expected results for validation
EXPECTED_STANDARDS = {
    "الأدوار والمسؤوليات لنظام استمرارية الاعمال.pdf": "5.9",  # Business Continuity
    "تقارير دورية للمشاريع أو الاتفاقيات المشتركة 1.4.pdf": "5.2.3",  # Joint Cooperation
}

def extract_pdf_text(filepath: Path) -> str:
    """Extract text from PDF using PyMuPDF."""
    doc = fitz.open(filepath)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text

async def test_file(filepath: Path):
    """Test classification for a single file."""
    print(f"\n{'='*60}")
    print(f"Testing: {filepath.name}")
    print(f"{'='*60}")

    # Extract text from file
    try:
        doc_text = extract_pdf_text(filepath)
        print(f"Extracted {len(doc_text)} characters")
        print(f"Preview: {doc_text[:300]}...")

    except Exception as e:
        print(f"ERROR extracting text: {e}")
        return None

    # Test classification
    try:
        result = await ai_service.analyze_document_for_standard(doc_text, filepath.name)

        print(f"\n--- Classification Result ---")
        print(f"Standard ID: {result.get('standard_id')}")
        print(f"Confidence:  {result.get('confidence')}")
        print(f"Tier:        {result.get('tier')}")
        print(f"Reasoning:   {result.get('reasoning')}")

        # Check against expected
        expected = EXPECTED_STANDARDS.get(filepath.name)
        if expected:
            detected = result.get('standard_id', '')
            if detected and detected.startswith(expected):
                print(f"\n✅ PASS: Expected {expected}, got {detected}")
            else:
                print(f"\n❌ FAIL: Expected {expected}, got {detected}")

        return result

    except Exception as e:
        print(f"ERROR classifying: {e}")
        import traceback
        traceback.print_exc()
        return None

async def main():
    print("="*60)
    print("DOCUMENT CLASSIFICATION TEST")
    print("="*60)

    # Get all PDF files in test directory
    test_files = list(TEST_DIR.glob("*.pdf"))

    if not test_files:
        print(f"No PDF files found in {TEST_DIR}")
        return

    print(f"Found {len(test_files)} test files")

    results = []
    for filepath in test_files:
        result = await test_file(filepath)
        results.append((filepath.name, result))

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")

    for filename, result in results:
        if result:
            std = result.get('standard_id', 'None')
            conf = result.get('confidence', 'None')
            tier = result.get('tier', '?')
            print(f"{filename[:40]:40} -> {std:8} ({conf}, Tier {tier})")
        else:
            print(f"{filename[:40]:40} -> ERROR")

if __name__ == "__main__":
    asyncio.run(main())
