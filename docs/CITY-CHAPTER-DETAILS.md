# Journey detail displays

The four journey steps now contain compact, themed detail displays inspired by the user's references. They replace the previous generic interaction samples with content specific to each step. Upright Orbitron remains the display family and Space Grotesk remains the supporting family. Headlines use fine traced edges, a restrained metallic accent gradient, a small segmented underline and three delicate eyebrow marks. There is no italic styling or repeating glitch animation.

## Content and sources

- **Follow:** archived RCB–CSK scorecard from 3 May 2025. RCB 213/5 and CSK 211/5, both after 20 overs; RCB won by two runs. Run rates 10.65 and 10.55 are calculated from those totals. The date and completed status remain visible. Official source: https://www.iplt20.com/matches/bd7c710f-ce79-40fc-93d9-fbf4bf83a794/More/scorecard. Supporting report: https://www.iplt20.com/news/article/tata-ipl-2025-match-52-rcb-vs-csk-match-report.
- **Predict:** “Who will be the Ballon d’Or winner?” with a 2027 label and an explicitly illustrative three-series forecast. Yamal, Mbappé and Haaland are example candidates; the plotted percentages are authored concept values, not live probabilities, votes or betting odds. Highlighting a candidate only changes the visual emphasis. The 2026 award was already decided, so the question looks to the following year. Official context: https://www.uefa.com/uefachampionsleague/news/02aa-21ec47378e70-b29defb43769-1000--harry-kane-wins-2026-mens-ballon-d-or/.
- **Quiz:** the 2026 NBA champions question uses New York Knicks as the correct choice; New York won the Finals 4–1. Choices give local feedback with a green correct state. Official source: https://www.nba.com/news/2026-nba-finals-schedule.
- **Play:** six angled artwork slices use existing local StatOz covers and canonical game destinations from `JOURNEY_GAMES`: Hoop Legacy, Cricketer, Pitch Rush, Formula, Longbow and Open Golf. Each slice opens its own game. Smaller screens use a native horizontal strip.

Facts checked on 16 November 2026. No live score service, forecast feed or shared product progress is implied. No new artwork download, font, library, canvas or per-frame React update is introduced.

The displays follow the existing journey reveal. Quiz choices and forecast highlights use local component state. The original product links remain below each display. Reduced motion disables hover animation, and compact and landscape layouts shorten the chart and arrange quiz choices in two columns.

Validation: the production build and TypeScript passed. All 11 targeted browser checks passed, covering four accessibility layouts, real links, the interactive forecast and quiz, the existing directional visit marker and venue navigation. After correcting the gallery's minimum grid width in landscape, both focused layout/interaction checks passed again. The Play action now ends at 280px, above the navigation at 307px on an 812 × 375 viewport.

Reviewed 30 journey states at 1440 × 950, 375 × 812, 768 × 950, 812 × 375 and 320 × 667. All heading styles are upright, and no state has page-level horizontal overflow. Screenshots, correct quiz states and measurements are in `docs/qa/chapter-details/`. Phone and landscape review uses browser emulation.
