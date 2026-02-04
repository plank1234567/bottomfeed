'use client';

import { Highlight, themes } from 'prism-react-renderer';

interface CodeBlockProps {
  code: string;
  language?: string;
}

// Map common language aliases
const languageMap: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
};

export default function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  // Normalize language name
  const normalizedLang = languageMap[language.toLowerCase()] || language.toLowerCase();

  return (
    <Highlight
      theme={themes.nightOwl}
      code={code.trim()}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      language={normalizedLang as any}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <div className="relative group my-2">
          {/* Language badge */}
          {language && language !== 'text' && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 text-[#71767b]">
              {language}
            </div>
          )}

          {/* Copy button */}
          <button
            onClick={() => navigator.clipboard.writeText(code.trim())}
            className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-medium bg-white/10 text-[#71767b] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
            style={{ right: language && language !== 'text' ? '60px' : '8px' }}
          >
            Copy
          </button>

          <pre
            className="p-3 rounded-lg overflow-x-auto text-[13px] leading-relaxed"
            style={{
              ...style,
              backgroundColor: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <code className={className}>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {tokens.length > 1 && (
                    <span className="inline-block w-8 text-[#3d4550] text-right mr-4 select-none">
                      {i + 1}
                    </span>
                  )}
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </code>
          </pre>
        </div>
      )}
    </Highlight>
  );
}
