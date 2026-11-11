# G1c.1 — independent real-photo expansion

**LENGTH — HOLD. Eight sources added; a new conservative browser gate reproduces a Chromium failure. No product changes or release.**

## A. Baseline

Continued clean `feat/g1c1-lash-fidelity` at `6975652ec6277b523973b8d4a02bd5e2b72d905b`; fetch confirmed feature unchanged, main `b02fac3c684f2a7e3178933cb66ded925ab8bce8`. [PR#5](https://github.com/Llayon/AuraGram/pull/5) remains Draft. Version0.5.1, last verified production `b883cf5d8cbcc75723b4701e98444fc349db4856`. Prior CI43006009516: buildPASS,162browserPASS,2originalF1FAIL,3dependentNOTRUN. Previous reports/evidence are unchanged.

## B. Dataset selection and provenance

Eight new photo assets were selected before detector-result review, using original publisher pages and camera/source descriptions as leads. They are not asserted to be eight distinct subjects. Native JPEGs, URLs, authors, dimensions and SHA256 are committed in [sources](tests/visual/expanded-evidence/sources.json). [Pexels license](https://www.pexels.com/license/) and [Unsplash license](https://unsplash.com/license) were checked2026-11-11; free photo pages, no paid/Plus or synthetic assets were downloaded. The fixtures are QA material, with no endorsement implied.

|Asset / contributor|Decoded native size|Original-only findings|Chromium / WebKit FaceMesh|
|---|---:|---|---|
|8727422 / Tima Miroshnichenko|3936×2624|Sharp pale shafts on one eye, overlapping loops/uncertain tips; other eye defocused|ready / ready|
|12367370 / aydin sefidi|3632×4540|Smoky makeup/liner, noise, applied-lash history unknown|ready / ready|
|7479551 / Angela Roma|4000×6000|Sharp closed-eye coated/clumped structures; useful distal detail|no_face / no_face|
|7123010 / Leah Newhouse|3648×5472|Closed eyes, white eyeliner, crossing hair; endpoints unresolved|ready / ready|
|purejulia / pure julia|4000×6000|Visible separated upper structures, partial second eye, soft terminal regions|no_face / no_face|
|andrey-eye / Andrey K|2624×3936|Closed cropped eye, fine and bundled visible shafts|no_face / no_face|
|18485027 / Oktay Köseoğlu|3857×6000|Large file but soft upper lash detail, hair and partial face — failed sharpness lead retained|no_face / no_face|
|7859838 / cottonbro studio|4416×2944|Open eyes, dark overlapping short upper structures, shadow; endpoints not certified|ready / ready|

High pixel dimensions are not evidence of resolved terminals. Bare/no-mascara status, biological strand identity and makeup history remain unverified. This adds pale/closed/liner/hair/partial/shadow controls; it does not close every required stratum. Separate valid moderate-quality selfies, controlled mascara/no-mascara and glasses coverage remain incomplete or inherited with limitations from older sources.

## C. Independent annotation and detection quality

13manual native viewing crops were screened, with detector overlays hidden. Their rectangles are **screen viewing coordinates, not FaceMesh landmarks**. The independent reviewer had algorithm/older-dataset exposure, but had not previously seen these new assets. Two annotation files were frozen before revealing outputs:

- First six sources: `3a32cb1c3769db18e53d258ee44e86a03300ed466c5fb10c3957a357cc2044cb`.
- Additional two sources: `f2c38c7dda2fdd3c4ed13521495c51c538a476eb8dc1448f539cb095d7dbe175`.

Nine provisional structures were marked:3purejulia,3closed coated7479551,3closedAndrey. Native endpoint uncertainty5–7px; local axes are not exact derivatives or certified human ground truth. No labels were forced on ambiguous pale/makeup/dark/blurred views. All9sampled structures belong to sources returning **no_face**. They cannot validate active Length accuracy, and must not be counted as isolated lash-analysis false negatives. End-to-end face eligibility remains a coverage limitation.

Both engines:4ready/4no_face. No invented geometry for excluded images. The frozen-geometry matrix imports no model; reanalysis exactly reproduces every stored tip object in both engines. Legacy0.5.1 eye rings are reconstructed by inverse of verified canonical topology and roundtrip checked (max normalized error≈1.12×10⁻¹⁶). All11baseline module files match production SHA after EOL normalization; ROI equations are unchanged. No coordinate order was guessed from screen-y.

|Ready source|Eligible Length tips C/W, left+right|Native Length50 changed pixels C/W, left+right|
|---|---|---|
|8727422|6+0 /6+0|99+0 /71+0|
|12367370|2+2 /2+3|17+13 /11+46|
|7123010|0+2 /0+0|0+30 /0+0|
|7859838|0+0 /0+0|0+0 /0+0|

Eligibility is an engineering gate, not true positive accuracy. Pale candidates may follow dark gaps/edges beside light strands. Makeup candidates are not certified natural hairs. Pixel efficacy does not settle either issue.

## D. Visual matrix and critic

[Gallery](tests/visual/expanded-evidence/index.html) contains325labelled image views backed by261deduplicated lossless PNGs: full720px portrait previews, native eye crops, production0.5.1/current Density50 and Length50, Length100, Definition50, combined25/25/20, ridge/confidence, accepted/rejected traces and difference×8. Native1x crops display at100/200/400% using pixelated enlargement without duplicate bitmaps. All native2x/4x PNGs also remain locally under `tests/visual/out/expanded-09-matrix`. Source JPEGs retain full resolution;720px portraits are labelled as viewing previews, not native exported files.

Legends: ridge green=response, density yellow=engineering support, accepted cyan/rejected red=diagnostic paths, amplified difference=RGB change, not final appearance. Diagnostic strokes do not enter product renders. Previous failed comparisons and production goldens are retained.

Independent critic found no obvious new blocks/halos/eye deformation in inspected pairs. This is not an exhaustive new protected-region certification. More importantly, useful **natural** Length remains unconfirmed: all independently sampled positives are in no_face images, and active pale/makeup candidates lack verified endpoint identity.

Concrete new instability: closed white-liner7123010 subject-right in Chromium has4observed crossing paths with axis coverage **0.24892758**, just below the0.25occlusion cutoff. It accepts2boundary-recovery candidates at confidence≈0.926 and changes31native pixels/RGBsum1239 atLength100. WebKit has5paths, coverage≈0.547526 and abstains. Each engine uses its actual real FaceMesh geometry; this difference is **not isolated to Canvas rasterization**. Near-identical apparent opening ratios do not establish cause.

## E. New safety gate and verification

Added `unresolved closed white-liner fixture abstains from Length after real analysis` to the mandatory browser suite. It explicitly requires real FaceMeshready and2native eye analyses, then zeroLength attempts, noLength ran flag and exact Length-only RGBA identity. No-face fallback or fully clipped strokes cannot pass it accidentally.

This is a **conservative product requirement for this frozen unresolved photograph**, not ground truth that lashes are absent and not a blanket ban on all closed eyes. Reviewers could not establish upper endpoints. Existing tests, thresholds, fixtures and goldens remain unchanged.

- Fresh unit: **138PASS**.
- New isolated gate: **ChromiumFAIL** (2drawing attempts), **WebKitPASS** (0attempts,0difference), both real analyses executed. The new failure is preserved withoutskip/xfail.
- Source/annotation/crop hashes verified; tip objects exactly reproduce metadata;8native originals/13views/9provisional labels; all11legacy modules validated against production; frozen replay verified without network.
- Full local single-worker browser suite: **163PASS,3FAIL,3dependentNOTRUN** (169total). Failures: original F1 Length efficacy in Chromium/WebKit plus new closed-white-liner abstention in Chromium. New WebKit abstention passes. No failures hidden/skipped or thresholds relaxed. Density efficacy/L6/L22, existing goldens/protections/cache/history/styles/session checks pass on their original fixtures.
- `npm run build`, `npm run package:site`, `npm run check:site`: **PASS**, including packaged Chromium native and mobile-WebKit software Canvas, real face detection, retouch and PNG export. Generated utility-CSS churn restored; no UI change.

`src/`, dependencies/version, Density35% bilinear cap, Length confidence/geometry/caps, UI/history/cache and renderer are unchanged. No additional product runtime/worker/model/service or upload was introduced.

## F. Resolution and performance

[Budget CSV](tests/visual/expanded-evidence/budgets.csv) retains5diagnostic analysis samples at224/320/384 per ready source/engine. Example Chromium pale8727422: left/right224×137/224×178 →320×196/320×254 →384×236/384×305. Eligible candidates6/8/9on one eye do not prove improved recall. Median both-eye analysis87.5/132.7/212.2ms in this diagnostic run. Makeup case drops4→3→1eligible candidates while time rises78.8→186.4→256.4ms. Do not infer quality from count alone or use these nonisolated timings as release benchmarks.

Cap stays224. CSV workingTypedBytesBoth sums declared per-eye array bounds, not measured simultaneous peak or process RSS; eye analysis is sequential. No upscale, source-analysis contract or retained-buffer budget changed. Physical iPhoneX/11/11ProMax/Android remain **UNVERIFIED**.

Fresh isolated `chromium-performance --no-deps --workers=1`: **3PASS**, sequentially after full browser tests. It does not convert full-suite NOTRUN to PASS. Natural720×1080 active Density35/Length100/Definition25: off17.3ms,active21.7ms,delta**+4.4ms**. Actual Length-only RGBsum227, Density206,2recovered tips and stable cached analysis/key are asserted. Cold107.3ms; native2400×3600 export render240.1ms,encode362.6ms,button→blob689.8ms,9,225,180bytes. This uses the established natural fixture, not the unresolved new closed-eye fixture. Legacy864×1080 medians62.2off/55.8active are timing noise, not a speedup claim; no product optimization occurred in this step.

## G. Release

**Draft PR#5 / HOLD.** No merge, ready, partial release, version bump, deploy or new published SHA. Two original Length F1 failures remain; a new documented conservative abstention failure now also blocks release. Production0.5.1 unchanged.

## H. Next minimal experiment

Prioritize the new reproducible negative fixture. At fixed JPEG/tips, sweep small offline geometry/sample perturbations around both actual7123010 geometries, retaining originals and never mutating app landmarks. Measure crossing evidence and activation around0.25 before choosing a robust conservative abstention rule; do not tune a magic cutoff solely to this image or weaken confidence/testing. Separately test pale-strand polarity versus neighbouring dark gaps using original-only labels. Resolved closed macro sources can support isolated center/axis studies, but cannot substitute for active full-portrait natural Length validation.
