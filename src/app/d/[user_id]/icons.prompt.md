1.) Inline SVG icon components (FontAwesome 6 Free solid paths, CC BY 4.0) so the dashboard needs no FontAwesome CDN: `IconDownload`, `IconCopy`, `IconShuffle`, `IconPlay`, `IconArrowUp`, `IconQuestion`, `IconPdf`, `IconClose`.
2.) Each renders `currentColor` at 1em inline (`h-[1em] w-[1em] align-[-0.125em]`), `aria-hidden` unless a `title` is given.
