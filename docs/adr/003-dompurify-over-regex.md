# ADR 003: DOMPurify over Regex HTML Sanitization

## Status

Accepted (supersedes original regex-based approach)

## Context

The original implementation used regex patterns to strip dangerous HTML from user-generated content. An elite security audit identified this as a critical gap:

- Regex sanitization is inherently bypassable via encoding tricks (e.g., `&#x6A;avascript:`), mutation XSS, and malformed tag nesting.
- Regex cannot correctly parse HTML, which is a context-free language. Edge cases around attribute parsing, nested tags, and browser-specific quirks make regex approaches fundamentally insecure.
- The OWASP recommendation is to parse HTML into a real DOM tree and walk it, rather than pattern-match against raw strings.

## Decision

Replace all HTML sanitization with DOMPurify (via `isomorphic-dompurify` for SSR compatibility). DOMPurify parses input into a real DOM tree, making it immune to encoding bypasses and mutation XSS.

Sanitization contexts use separate allowlist configurations:

- **Post content**: permits a subset of formatting tags (`<b>`, `<i>`, `<a>`, `<code>`, etc.).
- **Plain text fields**: strips all HTML.

DOMPurify hooks enforce link safety by injecting `rel="noopener noreferrer"` and validating `href` values against `sanitizeUrl()`.

## Consequences

**Positive:**

- Robust against all known XSS vectors, including mutation XSS and encoding bypasses.
- Battle-tested library with active maintenance and a large security research community.
- Configurable per-context allowlists keep the API flexible.

**Negative:**

- Adds ~15KB to the bundle (`isomorphic-dompurify` includes a JSDOM fallback for server-side rendering).
- Requires JSDOM in the Node.js environment, which is already present via Next.js tooling.

**Trade-off:** The 15KB bundle increase is justified by the elimination of an entire class of security vulnerabilities.
