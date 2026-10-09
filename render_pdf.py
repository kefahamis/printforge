import pdfkit
import os
import sys

# --- CONFIGURATION ---
# IMPORTANT: Update this path to where wkhtmltopdf is installed on your system.
# Common Windows paths:
# C:\\Program Files\\wkhtmltopdf\\bin\\wkhtmltopdf.exe
# C:\\Program Files (x86)\\wkhtmltopdf\\bin\\wkhtmltopdf.exe
WKHTMLTOPDF_PATH = r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe'

def render_html_to_pdf(html_input_path, pdf_output_path):
    """Renders a Jinja HTML template (after processing) to a PDF."""
    
    if not os.path.exists(WKHTMLTOPDF_PATH):
        print(f"ERROR: wkhtmltopdf not found at {WKHTMLTOPDF_PATH}")
        print("Please install it from https://wkhtmltopdf.org/downloads.html and update WKHTMLTOPDF_PATH in this script.")
        return

    config = pdfkit.configuration(wkhtmltopdf=WKHTMLTOPDF_PATH)
    
    options = {
        'page-size': 'A4',
        'margin-top': '0',
        'margin-right': '0',
        'margin-bottom': '0',
        'margin-left': '0',
        'encoding': "UTF-8",
        'no-outline': None,
        'enable-local-file-access': None,
        'disable-smart-shrinking': None,
        'zoom': '1.0', # Adjust if the scale feels off
    }

    print(f"Processing: {html_input_path}")
    try:
        # Note: In a real ERPNext environment, Jinja variables would be replaced first.
        # This script renders the HTML as-is for visual layout verification.
        pdfkit.from_file(html_input_path, pdf_output_path, configuration=config, options=options)
        print(f"SUCCESS: PDF created at {pdf_output_path}")
    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python render_pdf.py <filename_in_designs_folder>")
        print("Example: python render_pdf.py my_invoice.html")
    else:
        filename = sys.argv[1]
        designs_dir = os.path.join(os.getcwd(), "designs")
        input_path = os.path.join(designs_dir, filename)
        output_path = input_path.replace(".html", ".pdf")
        
        if os.path.exists(input_path):
            render_html_to_pdf(input_path, output_path)
        else:
            print(f"File not found: {input_path}")
