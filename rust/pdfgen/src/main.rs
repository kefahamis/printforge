//! PrintForge PDF renderer.
//!
//! Renders an exported PrintForge HTML design to PDF using a headless
//! Chromium browser (Chrome or Edge). Replaces render_pdf.py + wkhtmltopdf:
//! no Python, no 200MB wkhtmltopdf install, and a modern rendering engine
//! that matches what the editor canvas shows.
//!
//! Usage:
//!   pdfgen <input.html> [output.pdf]
//!   pdfgen designs\my_invoice.html

use std::env;
use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use anyhow::{bail, Context, Result};
use headless_chrome::types::PrintToPdfOptions;
use headless_chrome::{Browser, LaunchOptions};

// A4 in inches; matches the editor's 794x1123px canvas at 96 DPI.
const A4_WIDTH_IN: f64 = 8.27;
const A4_HEIGHT_IN: f64 = 11.69;

fn find_browser() -> Option<PathBuf> {
    if let Ok(p) = env::var("PDFGEN_BROWSER") {
        let p = PathBuf::from(p);
        if p.exists() {
            return Some(p);
        }
    }
    let pf = env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".into());
    let pf86 =
        env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".into());
    [
        format!(r"{pf}\Google\Chrome\Application\chrome.exe"),
        format!(r"{pf86}\Google\Chrome\Application\chrome.exe"),
        format!(r"{pf}\Microsoft\Edge\Application\msedge.exe"),
        format!(r"{pf86}\Microsoft\Edge\Application\msedge.exe"),
    ]
    .into_iter()
    .map(PathBuf::from)
    .find(|p| p.exists())
}

fn render(input: &Path, output: &Path) -> Result<()> {
    let input = fs::canonicalize(input)
        .with_context(|| format!("input not found: {}", input.display()))?;

    let browser_path = find_browser().context(
        "no Chrome or Edge found; set PDFGEN_BROWSER to a chromium-based browser exe",
    )?;

    let browser = Browser::new(
        LaunchOptions::default_builder()
            .path(Some(browser_path))
            .headless(true)
            .build()?,
    )
    .context("failed to launch headless browser")?;

    let tab = browser.new_tab()?;
    // canonicalize on Windows yields \\?\C:\... — strip the prefix for the URL
    let raw = input.to_string_lossy().replace(r"\\?\", "");
    let url = format!("file:///{}", raw.replace('\\', "/"));
    tab.navigate_to(&url)?.wait_until_navigated()?;

    let pdf = tab.print_to_pdf(Some(PrintToPdfOptions {
        print_background: Some(true),
        paper_width: Some(A4_WIDTH_IN),
        paper_height: Some(A4_HEIGHT_IN),
        margin_top: Some(0.0),
        margin_bottom: Some(0.0),
        margin_left: Some(0.0),
        margin_right: Some(0.0),
        prefer_css_page_size: Some(true),
        ..Default::default()
    }))?;

    fs::write(output, pdf)
        .with_context(|| format!("failed to write {}", output.display()))?;
    Ok(())
}

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: pdfgen <input.html> [output.pdf]");
        eprintln!("Example: pdfgen designs\\my_invoice.html");
        bail!("missing input file");
    }

    let input = PathBuf::from(&args[1]);
    if input.extension() != Some(OsStr::new("html")) {
        bail!("input must be an .html file");
    }
    let output = args
        .get(2)
        .map(PathBuf::from)
        .unwrap_or_else(|| input.with_extension("pdf"));

    let start = Instant::now();
    render(&input, &output)?;
    println!(
        "SUCCESS: {} -> {} ({} ms)",
        input.display(),
        output.display(),
        start.elapsed().as_millis()
    );
    Ok(())
}
