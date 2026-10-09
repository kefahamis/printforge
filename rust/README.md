# PrintForge Rust components

Two native components added for performance:

## pdfgen — native PDF renderer

Renders an exported HTML design (Export → As Jinja (HTML)) to PDF via headless
Chrome/Edge (auto-detected; override with the `PDFGEN_BROWSER` env var). It is a
quick local check that needs no Python or wkhtmltopdf install.

It is not what a Frappe site produces: Frappe prints through wkhtmltopdf, which is an
older engine and what the exported layout is built for. For the real result use the
PDF button in the builder's Preview on a site.

```
npm run build:pdfgen          # build (needs Rust + VS Build Tools)
npm run pdf designs\my_invoice.html   # render → designs\my_invoice.pdf
```

`render_pdf.py` does the same job through wkhtmltopdf, the engine Frappe uses.

## guides-wasm — smart-guides engine (WebAssembly)

The drag/resize alignment-guide math (`calcGuides`) compiled to WASM.
The JS implementation re-walked the node tree (O(N²) via findParent) on
every mousemove; the WASM path flattens boxes once per drag session
(`src/core/guidesEngine.ts`) and runs the 9-point comparisons natively.
Falls back to the JS implementation automatically if the module fails to load.

```
npm run build:wasm    # rebuild → src/wasm/guides (needs wasm-pack)
cargo test --manifest-path rust/guides-wasm/Cargo.toml   # unit tests
```

The built artifacts in `src/wasm/guides/` are checked in, so a plain
`npm run build` works without a Rust toolchain.
