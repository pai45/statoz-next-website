# City typography and briefing surfaces

The primary family is **Orbitron**: journey and venue headings, product navigation, major calls to action, route labels and destination markers. **Space Grotesk** is the secondary family for descriptions, instructions, distances and supporting copy. Both remain locally served WOFF2 variable fonts loaded through `next/font/local`; this revision adds no font downloads or runtime dependencies. The application maps the shared display/body tokens to those loaded families.

Journey headings previously used the secondary family and very tight tracking. They now use Orbitron with a wider line height, more natural spacing and sizes adjusted for its wider letterforms. Description text is larger and brighter. Shared page headings, venue titles and dialog headings follow the same primary family.

Journey copy uses a subtle angular briefing surface instead of a blurred patch. Its two clipped layers preserve a faint neutral outline, with one small chapter-colored accent and a translucent fill that reveals city detail. There are no scanlines, bloom or blur on this surface. The centered opening remains unboxed, using a crisp ink edge and shadow. Venue copy uses the same briefing treatment. The floating map and borderless directional visit marker retain their existing presentation.

The four interactive samples are removed from Follow, Predict, Quiz and Play, including their choice persistence and duplicate Games link. Each chapter keeps its headline, description and one real product link. Old saved sample choices cannot change those destinations. The briefing wrapper follows the existing chapter reveal and camera clock; its decorative layers ignore pointer input. The remaining links retain keyboard behavior and touch targets.

A subsequent reference-led revision adds four bespoke detail displays: an archived match scoreboard, an illustrative forecast, the 2026 NBA question and an angled gallery of actual StatOz games. Headings remain upright and use fine highlight edges and segmented underlines. Current behavior, sources and validation are documented in `CITY-CHAPTER-DETAILS.md`.

Visual review: six journey chapters at 1440 × 950, 375 × 812, 768 × 950 and 812 × 375, covering 24 states. Desktop and phone captures use WebGL; tablet and landscape use the reduced-motion fallback. Loaded display/body families were distinct, with no page overflow or copy extending into the bottom navigation. Screenshots and measurements are in `docs/qa/typography/`. Browser phone emulation does not replace physical-device testing.

Final validation: production build and TypeScript passed. All 11 targeted browser checks passed, covering four responsive accessibility layouts, destination visits and return focus, directional marker interaction, reduced motion/WebGL fallback, landscape, removal of all four samples, and the four retained product links even with saved sample choices present.
