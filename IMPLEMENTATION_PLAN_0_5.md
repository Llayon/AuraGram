# AuraGram 0.5.0: мобильные фильтры и пользовательские стили

Статус: выполнено; версия 0.5.0 опубликована и проверена 2026-11-10.

Объём подтверждён пользователем: пользовательские пресеты; проверка всех
фильтров и настроек после сообщения о неработающей контрастности на iPhone
в Telegram и Chrome. Проверка мобильных браузеров — эмуляция WebKit,
без заявления о проверке физического телефона.

## 1. Контрастность и совместимость

- [x] Воспроизвести проблему по пикселям: `contrast(200%)`, серый 96 → 64 в Chromium, 96 → 96 в исходном WebKit.
- [x] Определять работоспособность Canvas-фильтра по результату рисования.
- [x] Добавить локальный резервный путь: brightness, contrast, saturate, sepia, hue-rotate и blur.
- [x] Подключить его к превью, экспорту, миниатюрам, detail-слоям и маскам.
- [x] Сохранить нативный путь и его визуальные эталоны; ограничить временные буферы программной обработки.
- [x] Проверить реальный ползунок контраста и PNG: 96 → 80 при значении +50, оба изображения совпадают.

Операции цвета следуют CSS-матрицам в sRGB; маленький blur использует
разделяемую гауссову свёртку, большой — приближение тремя box-проходами.
Прозрачность обрабатывается в premultiplied RGBA; границы кадра прозрачные.
Цвет обрабатывается полосами по 128 строк, blur использует одну полную
пиксельную копию и один буфер строки. Это ограничение рабочих данных,
а не измерение RSS. Скорость на физических iPhone не заявляется.

## 2. Пользовательские стили

- [x] Независимая библиотека до 20 стилей, названия до 32 символов.
- [x] Сохраняются пресет, его сила, Beauty, ресницы, FX, коррекции и рамка; фото, подпись, геометрия и вкладки исключены.
- [x] Применение — одно действие истории; текущая подпись сохраняется.
- [x] Переименование, обновление и удаление не меняют открытое фото.
- [x] Защита от дубликатов, буквальное отображение HTML-подобных названий, сообщения об ошибках хранения.
- [x] Повреждённая библиотека заменяется только после явной очистки; удаление фотосессии сохраняет стили.
- [x] Диалог доступен на 320 px, поддерживает прокрутку, Escape и возврат фокуса.

Библиотека хранит только небольшой JSON в `localStorage`, ключ
`auragram.styles.v1`. Нет новых библиотек, серверов или отправки фотографии.

## 3. Проверки и выпуск

- [x] Пиксельная матрица 16 пресетов × силы 0/50/100, восемь коррекций, их диапазоны и маршрутизация ползунков, все FX.
- [x] Проверка изменения пикселей для шести Beauty-инструментов и трёх настроек ресниц на реальном портрете.
- [x] Сценарии библиотеки: повторная загрузка, Undo/Redo, переименование/обновление/удаление, квота, запрет хранения и повреждение записи.
- [x] Версионирование файлов сборки, включая импортируемые модули; сборка и smoke упакованного сайта.
- [x] Полный локальный прогон unit, Chromium/WebKit, визуальных эталонов и изолированных бюджетов.
- [x] PR, успешный CI, main и публикация Pages.
- [x] Проверка 0.5.0 на опубликованном сайте: контраст preview/PNG, стили, сессия, экспорт и отсутствие отправки фото.

Предыдущий выполненный этап: [`0.3.0`](IMPLEMENTATION_PLAN_0_3.md).

Локальная проверка 2026-11-10: **118 unit + 154 E2E пройдены**,
включая неизменённые эталоны Chromium и бюджеты I14/L20. Полный браузерный
прогон — 6,2 минуты. `npm run build`, `npm run package:site`,
`npm run check:site` успешны. Упакованная сборка проверена в Chromium и
WebKit mobile: версия файлов совпадает, контраст preview/PNG = 80/80,
движок `native` / `software` соответственно, распознавание лица и PNG работают.

Итог выпуска:

- [PR #3](https://github.com/Llayon/AuraGram/pull/3) прошёл [CI](https://github.com/Llayon/AuraGram/actions/runs/42780907293) и слит в `main`, коммит `66f9164`.
- [Проверка main и публикация Pages](https://github.com/Llayon/AuraGram/actions/runs/42781449754) успешны.
- [`npm run check:live`](https://llayon.github.io/AuraGram/?v=0.5.0) успешен в Chromium и WebKit mobile: HTML/runtime 0.5.0, версионированные модули, контраст preview/PNG **80/80**, режимы `native` и `software` соответственно.
- PNG 900×1125 скачан: Chromium — 1 486 406 байт, WebKit — 927 380 байт; корректная сигнатура, одно лицо, выбранные проходы ретуши и ресниц выполнены.
- Пользовательский стиль сохраняется и применяется после reload и удаления фотосессии. Undo/Redo, восстановление/удаление сессии работают. Ошибок JavaScript: 0; отправок фото на сервер: 0.
- Просмотрены мобильные скриншоты WebKit 375×667: окно стилей и редактор с контрастом +35.

## Проверка ресниц и патч 0.5.1

По запросу пользователя отдельно перепроверены густота, длина и выразительность.
На опубликованной 0.5.0 в Chromium и WebKit все три регулятора изменяют пиксели
на 25/50/100, усиливаются монотонно и сохраняются в PNG. При нуле результат
совпадает с исходником; вне ROI глаз и в контрольных точках радужек, бровей и губ
разница равна нулю. Дополнительно прошли 27 существующих проверок ресниц.

Увеличенное визуальное сравнение выявило дефект густоты на 100: отдельные
непрозрачные чёрные прямоугольники в области ресниц. Пиксельные проверки
локализации его не обнаруживали. В 0.5.1 заменено прямоугольное рисование
чёрных пикселей: билинейная выборка ridge-карты формирует плавный множитель
яркости не ниже 166/255, с учётом уверенности анализа глаза. Маска полосы,
защита уголков и отсечение по ROI сохранены; длина/выразительность не изменены.

После исправления: 120 unit и 155 браузерных проверок пройдены локально
(включая L20; I14 в этом выборочном запуске не запускался). Добавлен регрессионный
тест запрета чрезмерно чёрных блоков в Chromium/WebKit. Отдельный аудит через
ползунки 0/25/50/100 и PNG на реальном портрете также пройден в обоих движках.
У густоты 100 изменено 450/533 пикселя превью и 499/578 пикселей PNG
(Chromium/WebKit соответственно), без изменения контрольных областей.
Увеличенный результат просмотрен визуально. Проверка физических устройств
по-прежнему не заявляется.

Патч 0.5.1 опубликован и проверен 2026-11-10:

- [PR #4](https://github.com/Llayon/AuraGram/pull/4) прошёл [CI](https://github.com/Llayon/AuraGram/actions/runs/42788346004) и слит в `main`, коммит `b883cf5`.
- [Полный CI main и Pages](https://github.com/Llayon/AuraGram/actions/runs/42790955978) успешны: 120 unit и 156 браузерных проверок, включая I14/L20.
- Проверена фактически [опубликованная 0.5.1](https://llayon.github.io/AuraGram/?v=0.5.1): HTML/runtime совпадают; PNG, контраст 80/80, история, стили и сохранённая сессия работают в Chromium и WebKit.
- Отдельный аудит каждого ползунка 0/25/50/100 и PNG повторён на опубликованной версии. Числа изменённых пикселей совпали с локальным аудитом; вне ROI и в защитных контрольных точках разница равна нулю. Нарушений ограничения густоты не обнаружено.
- Экспорт 900×1125: Chromium 1 486 256 байт; WebKit 927 354 байта. Ошибок JavaScript и отправок фото на сервер нет.


## G1c.1 follow-up - HOLD

Native ROI / structure-tracing experiment is on `feat/g1c1-lash-fidelity`. It is not a release or a closed gauntlet. See [G1C1_REPORT.md](G1C1_REPORT.md) for artifacts, independent critique and red gates.

Recovery results: [G1C1_RECOVERY_REPORT.md](G1C1_RECOVERY_REPORT.md). Density efficacy and crossing-hair safety improved; Length visual usefulness remains HOLD. PR#5 stays Draft and production0.5.1 is unchanged.

Boundary-context localization follow-up: [G1C1_LOCALIZATION_REPORT.md](G1C1_LOCALIZATION_REPORT.md). Provisional original-only annotations, independent critic, both-engine frozen controls and active performance are preserved. Selected endpoint localization improves; useful Length and original F1 remain HOLD. No production publication.

Local tangent step: [G1C1_TANGENT_REPORT.md](G1C1_TANGENT_REPORT.md). Original-only short-window annotation cannot certify the left exact terminal tangent. Offline quadratic correction rejected; product unchanged, PR#5 Draft/HOLD. Next: source-luminance center refinement at fixed tips and renderer.

Native source profiles: [G1C1_SOURCE_CENTERS_REPORT.md](G1C1_SOURCE_CENTERS_REPORT.md). Fixed/free-anchor sensitivity explains short-window bias; no accurate unique terminal tangent established. Product unchanged; Draft/HOLD. Independent sharper real-photo endpoint/axis evidence is needed before adopting a continuation fit.

Real-photo expansion: [G1C1_EXPANDED_DATASET_REPORT.md](G1C1_EXPANDED_DATASET_REPORT.md). Eight new sources and independently frozen screening add challenge coverage;4ready/4no_face. Active natural Length still unverified. A new closed-white-liner abstention gate fails Chromium and passes WebKit; preserve it and study crossing-guard perturbations next. Draft/HOLD; production unchanged.

Crossing stability: [G1C1_CROSSING_REPORT.md](G1C1_CROSSING_REPORT.md). V6 fixes the closed-white-liner abstention gate with a conservative Length-only observed-crossing veto. Density/Definition remain exact; possible false vetoes in geometry-jitter controls are retained and material. Original F1 failures/useful Length remain HOLD. No production release.

Candidate-specific proximal continuation: [G1C1_ROOT_CONTINUATION_REPORT.md](G1C1_ROOT_CONTINUATION_REPORT.md). Offline Chromium/WebKit test rejected: all 70 repeated candidate observations unresolved, including closed/hair negatives. Last connected root-support pixels do not certify thin-fiber direction. Product v6 unchanged; next evidence must validate thin-ridge samples before merging with the lid and preserve negative cases while recovering a confirmed positive. Draft/HOLD.

Original-only positives and endpoint gate: [G1C1_POSITIVE_ENDPOINT_REPORT.md](G1C1_POSITIVE_ENDPOINT_REPORT.md). Three new licensed sources;10 independently frozen provisional coated-structure labels, no bare/light certification. C7ready/W6ready+1no_face including controls. Preterminal dark additions confirmed. Fixed old-set endpoint filtering partially suppresses artifacts but loses an old supported candidate; full rerun opens new seeds. Neither adopted. Product v6, F1 assertions and cap224 unchanged, Draft/HOLD. Next inspect fixed named residual artifact and PI729R1/R2 against native and downsampled profiles.

Three fixed endpoint cases: [G1C1_ENDPOINT_CASE_REPORT.md](G1C1_ENDPOINT_CASE_REPORT.md). Old C104-right-old16 and PI729R1/R2 stay fixed; native/coarse operators show direction-dependent continuation and unresolved bilateral support at a crease junction. Native RGBA equal across engines does not make coarse response identical. Anchor-offset sensitivity is not pure grid phase. No product adoption; next establish native pre-tip centers and same-structure axis support without new seeds or favorable phase selection. Draft/HOLD.

Native pre-tip centers: [G1C1_NATIVE_SHAFT_REPORT.md](G1C1_NATIVE_SHAFT_REPORT.md). Image-only bounded transverse centers and unanchored TLS measure R1 body direction and limited C104 support; R2 is window-dependent and fails dense contrast probes. Every available automatic axis tested forward: C104/R1 continue, R2 weak. Sparse/dense support is not endpoint/biological ownership proof;0→2association remains untested. Five analytic checks added to npm test; runtime, old assertions and cap unchanged. Next bounded endpoint/continuing/UNKNOWN experiment, Draft/HOLD.


## G1c.1 fixed-anchor association diagnostic (HOLD)

- [x] Continue same three frozen identities/all automatic axes; no manual direction, new candidate, recentering or product rendering.
- [x] Measure anchor-to-first-center sampled association and forward 0?12 native px; preserve losses/reentries and both decoders.
- [x] Independent source-pixel critic: C104 lateral departure likely; R1/R2 crease junction ambiguity. No endpoint approval or runtime adoption.
- [ ] Image-supported endpoint localization, useful natural Length, mandatory efficacy failures and full release gates remain unresolved.

See [anchor-association report](G1C1_ANCHOR_ASSOCIATION_REPORT.md) and retained gallery. Production unchanged.


## G1c.1 loss-neighborhood transverse profiles (HOLD)

- [x] Preserve fixed identities/all axes and measure loss +/-1 native px without manual direction or product tip moves.
- [x] C104 displaced support explains fixed-axis loss; R1/R2 retain edge/junction ambiguity. Preserve all 140 profiles and36figures.
- [x] Independent critic: margin counts use different distance neighborhoods and are correlated; no endpoint or same-fiber approval.
- [ ] Useful natural endpoint localization, mandatory Length efficacy and release gates remain unresolved.

See [loss-profile report](G1C1_LOSS_PROFILES_REPORT.md). Runtime/production unchanged.


## G1c.1 bounded curve following (prototype rejected, HOLD)

- [x] Same fixed identities/all axes; bounded local centers and dense links; no product tip move.
- [x] Preserve36real configurations,14initial analytic controls and192width/phase/sampling controls.
- [x] Independent critic identifies initialization mismatch, short first-fit support and half-pixel plateau; no endpoint/one-fiber approval.
- [x] Preserve initial L20 +17.1ms FAIL and isolated repeat PASS; no stable-performance claim.
- [ ] Subpixel center/initialization consistency, useful natural Length, mandatory efficacy and release gates remain unresolved.

See [curve report](G1C1_CURVE_REPORT.md). Runtime/production unchanged; no threshold relaxation.


## G1c.1 subpixel center and measured initialization (HOLD)

- [x] Bound observed center and bootstrap orientation; preserve .5search/15subsequent-turn/12arc budgets.
- [x] Independent critic reproduces disconnected-neighbor bias; V2restricts mass to connected contrast component and adds regression.
- [x] Retain all36real configurations, V0/V1/V2records and unchanged14/192analytic controls; budget reach36/192 to184/192 is not endpoint approval.
- [x] 159unitPASS; mandatory Length failures remain explicit; no existing assertions/goldens weakened.
- [ ] Same-fiber/free-end/natural-Length, held-out coverage and full release gates remain unresolved.

See [subpixel report](G1C1_SUBPIXEL_REPORT.md). Diagnostic candidate only; runtime/production unchanged.


## G1c.1 terminal/ownership observation audit (HOLD)

- [x] Preserve all36original12pxrecords exactly and compare with separate36px observation audit, not product Length.
- [x] C104continues35.75px with forward support; distinguish censored off-axis runs from complete runs and avoid branch/end claims.
- [x] Independent critic: endpoint/ownership not confirmed; legend overlap fixed and original views retained.
- [x] 162unitPASS; original Length failures remain; existing real unresolved-source negative product guards pass separately.
- [ ] Prototype held-out positive/free-end and independent negative ownership performance NOTCOVERED; naturalness/release gates remain open.

See [terminal report](G1C1_TERMINAL_REPORT.md). Runtime/production unchanged.

## G1c.1 source-frozen free-ending dataset audit (HOLD)

- [x] Retain seven new licensed source JPEGs, original-only independent annotations frozen before inference, and sequential-selection disclosure.
- [x] Run real FaceMesh/native224/320/384 analysis in both engines; four sources remain no_face without fabricated geometry.
- [x] Preserve production/recovery portraits, native100/200/400% crops, differences, response/confidence maps, paths and actual extension diagnostics.
- [x] Independent critic identifies projected-down upper endings outside current band; do not reinterpret them as absent hairs or weaken protected regions.
- [x] Verify source/snapshot/production bytes before/after NEW12 replays and retain initial07 evidence; runtime unchanged.
- [x] 162unitPASS;166browserPASS/2originalLengthFAIL/3dependentNOTRUN; new real macro abstention passes Chromium/WebKit; isolated active benchmark3PASS, delta+3.9ms.
- [ ] Useful natural Length, applicable positive/free-end coverage, physical devices and mandatory release gates remain open.

See [free-ending dataset report](G1C1_FREEEND_DATASET_REPORT.md). PR#5 remains Draft; no partial release.

## G1c.1 closed-eye geometry/domain audit (HOLD)

- [x] Freeze32eyes/16engine-source cases and reuse original-only labels without seeding analysis.
- [x] Measure opening clearance, signed upper distance, axial membership, aperture and fixed below-arc probes; retain all cutoffs and failures.
- [x] Replay native v6 crossing paths/flags/grids exactly in Chromium/WebKit without MediaPipe inference.
- [x] Critic/fixer: reject retracing/touching contours; preserve initial audit/helper and identical real-case measurements.
- [x] 171unitPASS, original166browserPASS/2LengthFAIL/3dependentNOTRUN; geometry is not a semantic upper-lash/skin mask.
- [ ] Actual image-only downward upper root/tip evidence, natural effect and original efficacy release gates remain open.

See [domain report](G1C1_DOMAIN_REPORT.md). No source geometry, product guards, renderer, model, version or production change.

## G1c.1 image-only downward connected graph (REJECT ADOPTION / HOLD)

- [x] Freeze parameters before new photo runs; automatic observed upper-arc seeds, no manual endpoints/directions.
- [x] Implement bounded directional ridge graph, measured root-zone attachment/TLS/width, unknown/border/protected/forward guards.
- [x] Critic/fixer addresses raster redundancy/root-zone samples and support-boundary localization; preserve V1 and failed V2 analytic gate.
- [x] V3 analytic8/8 tapered phases qualify, but all real hypotheses abstain:632/773 V1 and532/655 V3 C/W; no naturalness or same-fiber approval.
- [x] Local217 responses survive while directed root connection fails; observed-only loose diagnostic and mask subset checks isolate additional thinning losses.
- [x] 181unitPASS;166browserPASS/2originalLengthFAIL/3dependentNOTRUN; active old-engine perf3PASS. Existing assertions/goldens unchanged.
- [ ] Useful connected real endings, natural effect and mandatory release gates remain unresolved. Do not adopt prototype or relax guards.

See [downward report](G1C1_DOWNWARD_REPORT.md). Product source/version/production unchanged.
