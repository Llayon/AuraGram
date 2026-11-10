# G1c.1 Recovery Pass — HOLD

Следующий проход: [terminal-appearance experiments11–13](G1C1_TIP_FOLLOWUP_REPORT.md). Все три отклонены; продуктовый CV-код b46 сохранён, LENGTH остаётся HOLD.

Дата: 2026-11-10. **G1c.1 NOT CLOSED. PR#5 остаётся Draft. Merge, частичный Density-релиз и deploy запрещены текущими результатами.**

Density efficacy восстановлена с сохранением safety gates. Найден и исправлен реальный false positive на перекрывающих волосах. Length опирается на наблюдаемые структуры и меняет реальные pixels, но независимый critic не подтвердил достаточную визуальную пользу. Два исходных F1 остаются красными; пороги и исходные real-portrait tests не изменялись.

## A. Baseline

- Ветка: `feat/g1c1-lash-fidelity`; исходный HEAD `f496403afdd4b8399dcb492ecb83e9e304f0c0d3`.
- После `git fetch origin` main/origin/main были `b02fac3c684f2a7e3178933cb66ded925ab8bce8`; исходное рабочее дерево чистое, новых коммитов относительно указанного кандидата не было.
- [PR#5](https://github.com/Llayon/AuraGram/pull/5) подтверждён open/draft, head — указанная ветка, base — main. Работа продолжается в нём.
- Версия остаётся **0.5.1**. Production SHA, сообщённый пользователем: `b883cf5d8cbcc75723b4701e98444fc349db4856`. Diff retouch-модулей между ним и documentation HEAD b02fac3 пустой; production comparison использует закреплённый эквивалентный код.
- Перед изменениями воспроизведены **все6 browser FAIL**, а не заимствованы результаты предыдущего отчёта. [Лог](tests/visual/recovery-evidence/baseline-failures.txt).
- Unit baseline дополнительно проверен в отдельной копии **точного git archive f496403**, внутри `.snapshots/recovery-baseline-f496`: **126 PASS**. Рабочая ветка не переключалась и не сбрасывалась. Это отдельное воспроизведение baseline, не результат Recovery-кода.
- Прежние отчёт, evidence и история экспериментов сохранены. Force push/reset --hard не применялись.

Исходные отказы: F1 — Length difference0 в Chromium/WebKit; F2 —3 изменённых RGB-компонента вместо больше10 при Density100; F3 — L6 changedFrac ниже0.005; F4 — L22 band mean около0.0024 вместо больше0.02. Сценарии F1/F2 рендерят настоящий `edge-source.jpg` на450×563 с нейтральными прочими настройками. F1 устанавливает каждую настройку отдельно в100. L6 сравнивает Density25/50/75/100; L22 использует Density70/Length50/Definition60 на preview настоящего900px портрета.

## B. Root causes и изменения

Действующий ridge-map уже строился независимо от списка tips. Общими ограничителями были scalar confidence и несколько последовательных ослаблений. На edge900 редкие реальные детали терялись так:

1. `response>.018` принимался анализатором.
2. `smoothstep(.018,.09,response)` давал byte ridge меньше64 для слабого волоска.
3. Неизменённый `fillDensityRGBA()` обнулял значения до0.25 своей шкалы.
4. Coverage-confidence дополнительно умножал всю карту: в диагностике около0.037 для left и0.333 для right.
5. Анализ использовал полосу около0.65 eye opening, applicator — около0.35 eye height. Это могло отсекать distal details и даже целиком нарисованный Length. На edge900 большинство strong ridges уже были внутри старой Density mask, поэтому одна правка полосы не восстанавливала F2.

### Density evidence

- Сохранён **без изменения** `fillDensityRGBA()`: bilinear interpolation, hard cap35%, zero identity. Непрозрачных прямоугольников нет.
- Добавлены отдельные `densityConfidenceMap`, `densityRidge`, `densityConfidence`; Length использует собственные candidates/confidence.
- Local evidence учитывает направленную тёмную впадину, anisotropy, согласованные соседние samples, контраст и расстояние до века. Это инженерный score, не статистическая вероятность.
- Фильтр проверяет transverse scales0.75/1.5 analysis-px: меньшая проверяет тонкую деталь рядом с более тёмным макияжем. Сначала выбирается лучшая ориентация среди всех8, затем отбрасывается lid-parallel response.
- Для контраста используется локальная Weber-нормализация с ограниченным знаменателем: одинаковый абсолютный перепад на тёмном волоске и светлой коже не получает одинакового смысла. Absolute response floor и local coherence сохраняются.
- Correlated scores объединяются через ограничение слабейшим признаком, а не произведение, ошибочно напоминавшее joint probability. Поддержанный score один раз переводится в signal domain существующего Density compositing; повторного отсечения слабых наблюдаемых структур больше нет.
- Proximal Density использует локальные признаки, без полного root→tip trace. Для distal Density введено дополнительное наблюдаемое соединение к корневой зоне: так исключается верхняя crease/makeup boundary. Этот graph не имеет Length tip/width/length/confidence gates и не создаёт Length-кандидатов.
- Definition использует тот же поддержанный ridge-alpha внутри band, сохраняя независимые значения Density/Length/Definition.

### Connected Length

- Исправлен покомпонентный fallback `dx || normalX`, `dy || normalY`: настоящий нулевой компонент tangent больше не подменяется нормалью.
- Tracing допускает слабый **наблюдаемый** valley sample с anisotropy/coherence. Произвольных разрывов и невидимых сегментов нет; minimum4 measured samples не уменьшался.
- Одиночная неоднозначная ориентация на переходе контраста разрешается только при двух непосредственно наблюдаемых согласованных соседях и наличии transverse valley. Контекстно восстановленные samples не распространяют это правило дальше.
- Strong seed больше не считается автоматически кончиком. По наблюдаемому слабому продолжению выполняется outward tracing; clipped ends у границы анализируемой зоны отклоняются.
- Tangent определяется по локальной distal части волоска; путь через широкий тёмный root не используется как направление кончика. Width измеряется по относительному half-contrast, а не по фиксированному перепаду0.05, который отвергал слабые настоящие tips.
- Extension рассчитывается от непрерывно наблюдаемой distal длины. Сохранены gates eye≥0.25/tip≥0.6, connected evidence, максимум12% измеренной длины,3 analysis-px и12% eye-height. Цвет — из настоящего волоска; fading taper, постоянный набор кандидатов, без fan/random.
- Эксперимент alpha0.42 не получил visual usefulness подтверждения и **откачен до0.26**. Сохранены результаты этого неудачного сравнения.

### Crossing-hair safety

На frozen06 critic обнаружил настоящий запрещённый false positive: subject-left eye `hair-occlusion.jpg` полностью скрыт волосами, но Density менял234 native pixels, а Length продолжал один волос. Это **COVERED+FAIL**, а не отсутствие coverage.

Исправление использует исходную luma: ищет наблюдаемые направленные линии, проходящие через предполагаемую глазную щель и продолжающиеся далеко за lower lid. Выход через corner не считается crossing. Нет filename blacklist и новой модели. Seed spacing зависит от фактических ROI pixels; фиксированные11 seed positions оказались нестабильны при субпиксельных отличиях landmarks WebKit.

Два пространственно разнесённых crossing-пути дают консервативный whole-eye skip с причиной `crossing-structures`; отдельные crossing-линии исключаются локально. Это отрицательное evidence и engineering guard, не универсальный semantic classifier. Закрытый/неоднозначный глаз может быть пропущен. Универсальное старое обещание «волосы не могут быть затронуты по построению» удалено.

### Cache / lifecycle / memory

Native ROI без upscale, canonical lid arcs и их порядок сохранены. Cap остаётся224. Ключ анализа содержит photo identity, decoded dimensions, геометрию и версию **g1c1-recovery-4**. MediaPipe/анализ не запускаются на слайдере; фотоизолированный cache и Preview/Export geometry сохранены.

Для warm-render добавлен cache alpha masks: ровно4 slots, максимум65,536px на slot, всего не более1MiB. Большие export masks не кэшируются. Ключ включает всю выходную геометрию, размеры и feather. Дополнительные Canvas не создаются. Memory inventory теперь учитывает cached ImageData и retained analysis maps; старые ограничения9 Canvas и меньше4MiB на проверочном fixture сохранены.

## C. Detection quality

Полные данные: [Chromium](tests/visual/recovery-evidence/manifest-chromium.json), [WebKit iPhone11 emulation](tests/visual/recovery-evidence/manifest-webkit.json). Есть per-eye density coverage, seeds, accepted/rejected traces с причинами, measured samples, endpoint profiles, tangent/width, actual source/output extension, attempts и Length-only pixel changes.

### chromium

| Photo | Density pixels L/R | Analysis tips L/R | Renderer attempts50 L/R | Length50 changed pixels L/R |
|---|---:|---:|---:|---:|
|hair-occlusion.jpg|0/310|0/1|0/0|0/0|
|beauty.jpg|513/526|0/0|0/0|0/0|
|light.jpg|256/96|4/2|4/2|23/12|
|natural.jpg|216/376|3/7|3/7|12/28|
|edge900.jpg|58/65|0/0|0/0|0/0|
|eyeglasses.jpg|286/245|3/0|3/0|7/0|
|freckles-blonde.jpg|533/411|0/0|0/0|0/0|
|glasses.jpg|0/0|0/0|0/0|0/0|
|light-rotated25.jpg|229/119|5/1|5/1|22/7|
|low256.jpg|0/0|0/0|0/0|0/0|
|mascara.jpg|no_face|?|?|?|


### webkit

| Photo | Density pixels L/R | Analysis tips L/R | Renderer attempts50 L/R | Length50 changed pixels L/R |
|---|---:|---:|---:|---:|
|beauty.jpg|455/458|0/2|0/1|0/6|
|edge900.jpg|56/56|0/0|0/0|0/0|
|eyeglasses.jpg|234/293|6/0|5/0|23/0|
|freckles-blonde.jpg|552/386|1/0|0/0|0/0|
|glasses.jpg|no_face|?|?|?|
|hair-occlusion.jpg|0/341|0/3|0/3|0/14|
|light-rotated25.jpg|236/107|3/1|3/1|9/4|
|light.jpg|223/80|4/0|4/0|20/0|
|low256.jpg|0/0|0/0|0/0|0/0|
|mascara.jpg|no_face|?|?|?|
|natural.jpg|208/328|2/7|1/7|1/28|

[Compact detection summary](tests/visual/recovery-evidence/detection-summary.json).

Количество найденных структур не считается целью. Beauty и edge900 корректно не получают Length при недоказанном конце/направлении. На light/natural есть наблюдаемые connected candidates и реальные Length-only изменения. У скрытого волосами глаза final09 maps/tips/confidence обнулены; visible-right evidence сохранён.

`lengthAttempts` — отправленные renderer кандидаты. `visibleLengthCandidates` в manifest09 означает кандидатов с ненулевым Length-only difference внутри их bounding area; перекрывающиеся bounds могут переоценивать индивидуальную атрибуцию. Aggregate changedPixels/absoluteRGB измерены непосредственно, а не выведены из `ran`. `maxRGBSum` — максимум суммы абсолютных ΔR+ΔG+ΔB одного pixel, диапазон0..765, не max одного канала. В ранних manifest поле называлось `maxRGB` с тем же смыслом.

### Dataset / provenance

В final09 —11 сценариев:8 независимых лицензированных источников и3 производных реальных фото (edge900, low256, rotation25°). Ни одна AI-картинка не используется как доказательство натуральности. [Provenance, authors, URLs, лицензии и SHA256](tests/visual/recovery-evidence/sources.json). Новые source pages явно разрешают Unsplash License. Названия `light`, `glasses`, `mascara` не являются ground truth.

| Требуемый сценарий | Покрытие |
|---|---|
|Натуральные без туши|PARTIAL: eyeglasses не имеет видимой туши; отсутствие косметики документально не подтверждено|
|Светлые ресницы|NOT COVERED: светлые волосы/веснушки не считаются светлыми ресницами|
|Тёмные ресницы|COVERED: light/natural/beauty|
|Лёгкий макияж|COVERED по видимому состоянию freckles-blonde; тип косметики не установлен|
|Выраженная тушь|PARTIAL: выраженные тёмные/сгруппированные волоски light/natural; косметический состав неизвестен|
|Подводка/eye makeup|COVERED: beauty|
|Слабый контраст без видимой косметики|PARTIAL: eyeglasses, включая теневую сторону|
|Высокое разрешение|COVERED: beauty3000×3751 и другие native sources|
|Низкое разрешение|COVERED guard: реальный downscale256; это производный источник|
|Поворот головы|COVERED для in-plane roll: реальное фото, canvas rotation25°; не новый независимый ракурс|
|Перекрытие волосами|COVERED: реальный hair-occlusion, final hidden-eye identity PASS|
|Очки/закрытый глаз|COVERED: настоящие eyeglasses и закрытый глаз glasses; WebKit не нашёл лицо на closed-eye источнике|

`mascara` остаётся no_face в обоих движках; failure сохранён. Достоверный noisy phone selfie и новые физические ракурсы не получены — NOT COVERED.

## D. Visual quality / independent critic

[Сохранённая review gallery](tests/visual/recovery-evidence/index.html). В git включены native Combined full portraits, Original/0.5.1/Recovery crops обоих глаз100/200/400%, debug maps, difference и примеры неудачного06. Полные исходные beauty/light/natural portraits также сохранены в прежнем `tests/visual/g1c1-evidence`; новые originals включены в Recovery evidence.

Полная локальная lossless matrix всех сценариев/обоих движков: `tests/visual/out/recovery-final-09-streamed/index.html`. В ней дополнительно есть f496 HOLD comparison, Density1/25/50/75/100, Length25/49/50/51/75/100, обе ориентации глаз, raw response, density confidence, accepted/rejected traces, crossing lines, actual extension geometry и difference×8. Легенды сохранены в gallery и manifest.

Source snapshots и SHA256 в обоих движках совпадают с проверенным CV-кодом. Главные hashes:

- `lashAnalysis.mjs`: `87f964abc6ea…`
- `lashEnhancement.mjs`: `6c28059e51e8…`
- `retouch.mjs`: `4014946ff64e…`

**Итог отдельного independent critic для final09:**

- Density естественно усиливает поддержанные волоски, сохраняет промежутки и асимметрию; новых непрозрачных блоков, полос, halo, двойного века на просмотренных PNG нет.
- Beauty parallel crease защищена заметно лучше ранних attempts; неоднозначные короткие детали внутри band остаются риском.
- Настоящая оправа и rotation25° не получили новых видимых артефактов. Абсолютная identity всей оправы не заявляется: в06 найден один native pixel с поканальным Δ1.
- Hidden-left hair case **pixel-for-pixel identity** для Original/Density50/Definition50/Length100/Combined в обоих движках. Final confidence0/tips0; visible-right Density продолжает работать. Blocker06 исправлен на реальном источнике.
- Length имеет настоящие микроизменения, следует структурам, не создаёт fan/иголок. Но полезное удлинение на light/natural практически неразличимо при200–400% и на полном портрете. Pixel deltas не заменяют visual usefulness.

**Вердикт: LENGTH — HOLD. Выпуск не рекомендован.** [Полный critic verdict](tests/visual/recovery-evidence/critic.txt).

Неудачные стадии не удалены: soft-evidence01, visual03/04, frozen06, crossing diagnostics01/02/03, final07/08 и их логи остаются локально. Failed06 hair PNG дополнительно включены в git. Увеличение opacity0.42 отклонено; ранние crossing guards либо пропускали hidden eye, либо ошибочно считали обычный iris crossing-структурой — эти отрицательные результаты также сохранены.

Unstreamed final08 WebKit оборвался на native beauty evaluation; параллельный functional run дал148PASS/12FAIL/3NOT RUN с process exits/timeouts/Canvas проблемами. Это не выдаётся за успешную проверку. Harness удерживал много full-res data URLs; теперь каждый native PNG/crop записывается и Canvas освобождается сразу, разрешение/число сравнений не уменьшены. Старый зависший harness остановлен, данные сохранены. После исправления оба final09 matrix завершились; следующий полный функциональный прогон выполнен отдельно и оставил только2 исходных F1.

## E. Tests

- **133 unit PASS**:126 baseline сохранены; добавлены7 проверок local soft evidence, noise/liner rejection, illumination normalization, faint endpoint continuation, clipped end, crossing-line negative evidence и continuous/scaled geometry.
- Полный `npm run test:e2e`: **158 PASS,2 FAIL,3 dependent performance checks NOT RUN**.
- Три performance checks затем отдельно выполнены в изоляции: **3 PASS**. Это не превращает красный полный/CI прогон в GREEN.
- Оставшиеся2FAIL — исходный F1 в Chromium/WebKit: Length на edge900 даёт0 вместо больше10. Видимые подходящие кандидаты не доказаны; thresholds, fixture и assertion не изменены.
- F2 Density browser efficacy/35% safety, F3 L6, F4 L22 — **PASS**. Targeted suite из9 проверок, включая memory, real occlusion и active Preview/Export, — **9 PASS**.
- Golden-файлы не перегенерировались. Existing background/iris/brow guards, preset independence, deterministic/zero identity, rotated/cropped protection, Undo/Redo/styles/session/reset и no-reanalysis checks проходят в отдельном полном прогоне.
- `npm run build`, `npm run package:site`, `npm run check:site` — **PASS**. Packaged Chromium native и WebKit software Canvas: реальные face detection, фильтры и PNG export прошли.
- Новые real tests усиливают coverage: скрытый глаз exact identity, видимый глаз сохраняет evidence; Length-only pixels проверяются отдельно в preview и full PNG2400×3600 в обоих движках.

Логи: [unit](tests/visual/recovery-evidence/unit.txt), [browser](tests/visual/recovery-evidence/browser.txt), [targeted](tests/visual/recovery-evidence/targeted.txt), [performance](tests/visual/recovery-evidence/performance.txt), [packaged](tests/visual/recovery-evidence/packaged-site.txt).

Ни один падающий обязательный тест не удалён, не skipped и не ослаблен. Изменения infrastructure: bounded streaming/frozen visual harness, более точная telemetry и новые positive/negative tests. Общий тест «valid FaceMesh означает Length efficacy» не переписывался под честный fallback.

## F. Performance

Последний isolated `chromium-performance --no-deps`, один worker, без параллельного visual harness:

| Тест | Off median | Active median | Delta |
|---|---:|---:|---:|
|Existing L20,864×1080, edge900|70.5ms|73.4ms|**+2.9ms PASS**|
|Active Density35+Length100+Definition25,720×1080,natural|16.0ms|17.7ms|**+1.7ms PASS**|

Первый L20 выполняет Density/Definition, Length там пропускается. Второй обязателен отдельно: `ran` содержит density/length; реальные preview Length-only difference200 RGB units приLength100 и Density-only206 приDensity35; proof использует **те же strengths**, что timed active pass. Cache key и analysis timing стабильны. Это измерение работающего Length, а не молчаливого noop. Разный grade/aspect у двух fixtures не позволяет сравнивать их абсолютные off-times между собой; сравнение только внутри строки. Полный Length100 во второй строке выбран для проверяемого ненулевого воздействия; moderate30 на том же source не выдаётся за подтверждённый active Length benchmark.

Active natural: cold analysis103.4ms; full export2400×3600 render184.7ms, PNG encode348.4ms, button→blob613.4ms, PNG9,225,147bytes. Выход действительно содержит active Length. Код таймера отдельно измеряет render/encode, button→blob включает UI scheduling/polling. [Raw log](tests/visual/recovery-evidence/performance.txt).

До mask cache observed L20 delta+20.9ms **FAIL**; этот результат сохранён отдельно. Исправление не пропускает compositing: оно повторно использует geometry-only mask, а Density/Length pixel proof остаётся обязательным.

| Engine/photo |224 first ms|224 median ms|320 median ms|384 median ms|
|---|---:|---:|---:|---:|
|chromium/hair-occlusion.jpg|80.8|32.9|34.5|22.9|
|chromium/beauty.jpg|121.3|60.8|158.1|116.1|
|chromium/light.jpg|78.9|60.7|29.6|35.3|
|chromium/natural.jpg|112.2|54.2|58.4|50.5|
|chromium/edge900.jpg|38.2|27.0|16.8|13.6|
|webkit/beauty.jpg|104.0|58.0|109.0|127.0|
|webkit/edge900.jpg|29.0|17.0|18.0|15.0|
|webkit/hair-occlusion.jpg|70.0|50.0|34.0|29.0|
|webkit/light.jpg|77.0|44.0|32.0|33.0|
|webkit/natural.jpg|95.0|69.0|42.0|45.0|


Таблица cold/224/320/384 из visual matrix — диагностические многократные измерения, некоторые проходили параллельно с functional jobs, не физические mobile SLA. Последний isolated benchmark выше — отдельный проверочный запуск. Выше224 cap не повышается: нужен доказанный visual benefit, которого большие caps здесь не установили.

Memory: максимум49*n typed working bytes при n≤224² (2,458,624bytes), retained maps5*n на глаз. Дополнительно crop Canvas/RGBA и JS evidence/queues; **это не RSS/heap/GPU измерение**. Новый mask cache ограничен1MiB, число Canvas не увеличено. L21 по-прежнему проверяет≤9 Canvas и total accounted bytes меньше4MiB на fixture, теперь с учётом cached masks/retained maps.

Cold analysis остаётся main-thread работой порядка десятков/сотни ms; jank на старых телефонах не исключён. Worker не добавлен ради формальности; offload чистого анализа имеет смысл оценить после visual acceptance. WebKit mobile/PNG проверен программно. Физические iPhone X/11/11 Pro Max и Android: **UNVERIFIED**.

## G. Release

**HOLD.** [Draft PR#5](https://github.com/Llayon/AuraGram/pull/5) остаётся единственным PR этой работы. [Workflow runs ветки](https://github.com/Llayon/AuraGram/actions?query=branch%3Afeat%2Fg1c1-lash-fidelity). Итоговый SHA и последний workflow URL приводятся в сообщении завершения; hashes проверенного кода/матриц закреплены выше и в manifest.

Merge/deploy/partial Density release не выполняются. Нового production version/published SHA нет; `check:live` новой версии неприменим. Версия0.5.1, MediaPipe package и model не менялись; SelfieMulticlass не добавлялся. Production https://llayon.github.io/AuraGram/ этой веткой не изменяется.

Воспроизведение:

```powershell
npm test
npm run test:e2e
npm run test:e2e -- --project=chromium-performance --no-deps
npm run build
npm run package:site
npm run check:site
node tests/visual/prepare-lash-audit.cjs
./tests/visual/prepare-recovery-dataset.ps1
node tests/visual/prepare-recovery-variants.cjs
$env:LASH_RUN='recovery-new-immutable-run'
$env:LASH_FIXTURE='hair-occlusion.jpg,beauty.jpg,light.jpg,natural.jpg,edge900.jpg,eyeglasses.jpg,freckles-blonde.jpg,glasses.jpg,light-rotated25.jpg,low256.jpg,mascara.jpg'
node tests/visual/lash-fidelity.cjs
node tests/visual/lash-fidelity.cjs --webkit
```

Новый LASH_RUN обязателен; повторная запись уже начатого engine запрещена. Второй движок использует те же frozen sources. Публичные fixtures скачиваются отдельно; пользовательские фото наружу не отправляются. Для воспроизводимого timing запускайте performance после завершения visual/functional jobs.

## H. Remaining risks / минимальный следующий эксперимент

Главный blocker — **недоказанная визуальная польза Length**, плюс неизменённый F1 на edge900. Не заменять это затемнением или искусственными штрихами.

Следующий минимальный эксперимент: на лицензированном macro portrait с достаточно разрешёнными настоящими кончиками измерить поперечный/продольный RGB-профиль последних2–3 samples и сравнить contrast-matched taper с текущей фиксированной прозрачностью. Confidence gates, candidate set и max extension оставить неизменными; оценивать реальный preview и оба глаза, затем200/400%. Только после положительного независимого visual proof можно обсуждать корректность универсального F1 при отсутствии detectable tips, не снижая уровень защиты тестов.

Открыты pale/very low-contrast lashes, clumped mascara, косметика и короткие crease/JPEG structures внутри band, noisy phone photos, partial crossing hair, false-negative skip закрытого глаза и Safari/старые iPhone. Crossing guard исправил конкретный real failure и имеет negative tests, но не является универсальной segmentation моделью. Полные физические device timings/RSS не подтверждены. Ни Density progress, ни ненулевые pixels, ни зелёный isolated performance не закрывают G1c.1.
