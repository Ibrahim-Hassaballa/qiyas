import asyncio
import os
import sys
from pathlib import Path
import logging

# Add project root to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

# Import services
# Note: We need to make sure the environment variables are loaded or config is accessible
from Backend.Source.Services.DocumentService import DocumentService
from Backend.Source.Services.AIService import ai_service

# Configure logger
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

async def mock_extract_text_from_path(file_path: Path):
    class LocalFile:
        def __init__(self, path): 
            self.path = path
            self.filename = path.name
            self.content_type = "application/pdf" if path.suffix.lower() == ".pdf" else "application/octet-stream"
        
        async def read(self):
            with open(self.path, "rb") as f: 
                return f.read()
    
    local_file = LocalFile(file_path)
    return await DocumentService.extract_text(local_file)

async def test_files(output_file):
    test_dir = Path(r"C:\Users\hp\Desktop\Hekata\QiyasAI\Data\Test")
    if not test_dir.exists():
        output_file.write(f"Directory not found: {test_dir}\n")
        return

    files = list(test_dir.glob("*.[pP][dD][fF]"))
    output_file.write(f"Found {len(files)} PDF files in {test_dir}\n")

    for file_path in files:
        output_file.write(f"\n--------------------------------------------------\n")
        output_file.write(f"Processing: {file_path.name}\n")
        output_file.write(f"--------------------------------------------------\n")
        try:
            output_file.write("Extacting text... ")
            text = await mock_extract_text_from_path(file_path)
            output_file.write(f"Done. Extracted {len(text)} characters.\n")
            
            if not text.strip():
                output_file.write("WARNING: Extracted text is empty!\n")
                continue

            output_file.write("Analyzing for standard... ")
            result = await ai_service.analyze_document_for_standard(text, file_path.name)
            output_file.write("Done.\n")
            
            output_file.write(f"\n>>> RESULT <<<\n")
            output_file.write(f"Standard ID: {result.get('standard_id')}\n")
            output_file.write(f"Confidence: {result.get('confidence')}\n")
            output_file.write(f"Tier:       {result.get('tier')}\n")
            output_file.write(f"Reasoning:  {result.get('reasoning')}\n")
            output_file.flush()
        except Exception as e:
            output_file.write(f"\nERROR: {e}\n")
            import traceback
            traceback.print_exc(file=output_file)

if __name__ == "__main__":
    with open("verification_report.txt", "w", encoding="utf-8") as f:
        # Redirect stdout to this file for the duration of the script if needed, 
        # but let's just pass the file handle
        asyncio.run(test_files(f))
