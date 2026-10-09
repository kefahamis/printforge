// Structural check of generated template HTML: balanced {{ }} / {% %}, if/for blocks and
// HTML tags. It catches the mistakes hand-typed bindings and rich text introduce; it is
// not a Jinja parser.

// Standard HTML void tags (do not require closing tags)
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr", "!doctype"
]);

export function lintJinja(code) {
  const lines = (code || "").split("\n");
  const errors = [];
  const htmlStack = [];
  const jinjaStack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // 1. Brace matching
    const openBrace = (line.match(/\{\{/g) || []).length;
    const closeBrace = (line.match(/\}\}/g) || []).length;
    if (openBrace > closeBrace) errors.push({ line: lineNum, message: "Unclosed '{{' brace." });
    else if (openBrace < closeBrace) errors.push({ line: lineNum, message: "Unexpected '}}' brace." });

    const openBlock = (line.match(/\{%/g) || []).length;
    const closeBlock = (line.match(/%\}/g) || []).length;
    if (openBlock > closeBlock) errors.push({ line: lineNum, message: "Unclosed '{%' block." });
    else if (openBlock < closeBlock) errors.push({ line: lineNum, message: "Unexpected '%}' block." });

    // 2. if / for matching ("{%-" whitespace-control tags included)
    for (const match of line.matchAll(/\{%-?\s*([a-zA-Z0-9_]+)/g)) {
      const keyword = match[1];
      if (keyword === "if" || keyword === "for") {
        jinjaStack.push({ tag: keyword, line: lineNum });
      } else if (keyword === "endif" || keyword === "endfor") {
        const opener = keyword.slice(3);
        if (jinjaStack.length === 0 || jinjaStack[jinjaStack.length - 1].tag !== opener) {
          errors.push({ line: lineNum, message: `Unexpected '{% ${keyword} %}'.` });
        } else {
          jinjaStack.pop();
        }
      }
    }

    // 3. HTML tag matching, with template tags removed first
    const htmlLine = line.replace(/\{%.*?%\}/g, "").replace(/\{\{.*?\}\}/g, "");
    for (const match of htmlLine.matchAll(/<\/?([a-zA-Z0-9!]+)[^>]*>/g)) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();

      if (fullTag.endsWith("/>") || VOID_ELEMENTS.has(tagName) || fullTag.startsWith("<!--")) continue;

      if (fullTag.startsWith("</")) {
        // Pop the nearest matching tag
        let found = false;
        for (let j = htmlStack.length - 1; j >= 0; j--) {
          if (htmlStack[j].tag === tagName) {
            htmlStack.splice(j, 1);
            found = true;
            break;
          }
        }
        if (!found) errors.push({ line: lineNum, message: `Unexpected closing tag </${tagName}>.` });
      } else {
        htmlStack.push({ tag: tagName, line: lineNum });
      }
    }
  }

  while (jinjaStack.length > 0) {
    const unclosed = jinjaStack.pop();
    errors.push({ line: unclosed.line, message: `Unclosed '{% ${unclosed.tag} %}' block.` });
  }
  while (htmlStack.length > 0) {
    const unclosed = htmlStack.pop();
    errors.push({ line: unclosed.line, message: `Unclosed HTML tag <${unclosed.tag}>.` });
  }

  return errors.sort((a, b) => a.line - b.line);
}
