# AURAGRAM G1c.1 — LENGTH HOLD

Продолжение: [G1c.1 Recovery Pass](G1C1_RECOVERY_REPORT.md). Этот документ и первоначальные evidence сохранены как исторический baseline.

Дата: 2026-11-10. **G1c.1 НЕ CLOSED. Ветка не готова к merge/deploy.**

Нативный ROI и трассировка реализованы. Рисованных штрихов стало меньше, но полезное натуральное удлинение недостаточно доказано. Эффективность Density на существующем fixture также регрессирует. Тестовые пороги не ослаблены. Это исследовательский кандидат, а не готовый Density/Definition-релиз.

## A. Baseline

- Выполнен `git fetch origin`. HEAD = main = origin/main = `b02fac3c684f2a7e3178933cb66ded925ab8bce8`.
- Версия package.json: **0.5.1**. Указанный пользователем production SHA: `b883cf5d8cbcc75723b4701e98444fc349db4856`.
- Исходное дерево чистое; AGENTS.md в корне и проверенных родительских каталогах отсутствует.
- Рабочая ветка: `feat/g1c1-lash-fidelity`. Force push/reset --hard не применялись.
- До изменений: **120 unit PASS, 156 browser checks PASS**, включая Chromium/WebKit mobile.
- Логи: [baseline unit](tests/visual/g1c1-evidence/baseline-unit.txt), [baseline E2E](tests/visual/g1c1-evidence/baseline-e2e.txt).
- Исходные модули скопированы до изменений. Визуальный baseline воспроизводится из закреплённого SHA через `git show`, а не из меняющейся production-страницы.

## B. Root causes

Старый `lashRoiSize` умножал обе нормализованные стороны на 320, независимо от decoded dimensions. Минимум 24×16 также мог искусственно увеличивать маленький ROI.

На настоящем beauty-источнике **3000×3751** прежние ROI: left **35×19**, right **40×19**. Теперь при cap224: left **224×155**, right **223×131**, без upscale. Это другой aspect ratio, чем обязательный пример 3000×2400; тот проверяется отдельно вместе с 320×400, 720×900, 1080×1350 и 4032×3024.

Старые tips выбирались по верхнему тёмному пикселю колонки. Направление назначалось через нормаль и детерминированный fan. Связность, реальный tangent и ширина волоска не измерялись; макияж мог выглядеть как ресница.

## C. Implementation

- `eyeGeometry.mjs`: новый `lashRoiSize(roi, sourceWidth, sourceHeight, budget)` возвращает `w,h,rawW,rawH,scale,scaleX,scaleY,status`. Масштаб не больше1, округление вниз даёт менее1px ошибки стороны. Есть ограничения стороны/площади; ROI меньше32×12 получает `low-resolution` и пропускается. Default224; экспериментальные caps320/384; абсолютный предел384.
- Верхняя/нижняя дуги и corners определяются по каноническим индексам `FACE_REGIONS`. Проверен [первичный источник MediaPipe](https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/mediapipe/python/solutions/face_mesh_connections.py). Landmarks не изменяются; subject-left/right различаются. Нормаль направлена от нижней дуги. После critic удалена сортировка по X, разрывавшая дугу при наклоне. Тест проверяет точную последовательность, нормаль, ±60° и partial crop.
- `lashAnalysis.mjs`: восемь направленных симметричных dark-valley filters, локальная яркость и Laplacian. Сначала выбирается лучшее направление среди **всех** восьми, затем исключается lid-parallel response. Иначе second-best косой ответ мог ошибочно представлять подводку как волосок.
- Трассировка идёт от дистальной структуры к веку через соседние наблюдаемые пиксели. В proximal zone разрешены тёмные пиксели широкого корня, сливающегося с lash line. Путь должен достигать расстояния не более2 analysis-px от века. Разрывы не достраиваются.
- Проверяются число измеренных samples, длина, прямолинейность, ориентационная согласованность, контраст, sharpness и outward tangent. Кончик и tangent получаются из локального хвоста трассы. Ширина измеряется поперечным профилем; слишком широкие структуры пропускаются. Цвет берётся из наблюдаемого волоска. Evidence и причины отказа сохранены. Confidence — инженерный score проверяемых признаков, **не калиброванная вероятность**.
- `lashEnhancement.mjs`: Length использует фиксированный набор кандидатов, измеренный tangent, непрерывные длину/альфу и taper. Максимум12% наблюдаемой длины, также ограничен3 analysis-px и12% eye-height. Нет fan/random или slider-dependent количества tips. Length пропускается при eye confidence ниже0.25, tip confidence ниже0.6, отсутствии connected evidence/цвета.
- Density `fillDensityRGBA` сохранена: bilinear sampling, confidence, максимум35% затемнения, zero identity. Непрозрачных fillRect нет. **Новая ridge-карта слишком слаба на существующем 900px fixture — известная регрессия.**
- Definition ослаблен до contrast(115%) и ограничен ridge-alpha × lash-band × confidence. Настройки Density/Length независимы. Широкая полоса макияжа больше не обрабатывается целиком.
- Маска использует каноническую дугу и наружные нормали. Feather обрезан исходным разрешённым полигоном; inner corner/brow исключены. Definition/Density используют одну построенную маску за eye/pass.
- `retouch.mjs`: cache key содержит imageId, фактические decoded dimensions, версию `g1c1-trace-1`, eye/brow geometry и WeakRef source identity. Слайдер не перезапускает анализ. Анализ синхронный; временный Canvas освобождается в finally. Новые ImageBitmap не создаются. Preview/Export используют исходный анализ. Новой модели, внешнего AI-инференса и Worker нет.

Выбран минимальный directional-filter + local-tracing подход. Полного эмпирического сравнения со structure tensor/curve fitting не проведено; утверждения о лучшем из всех возможных методов нет.

## D. Visual results / Builder → Critic → Fixer

[Сохранённая подборка обоих глаз при400%](tests/visual/g1c1-evidence/index.html): Original, old/new Length50, new Density50, Definition50, traces и difference ×8. Полные originals: [beauty](tests/visual/g1c1-evidence/beauty-full-original.jpg), [light](tests/visual/g1c1-evidence/light-full-original.jpg), [natural](tests/visual/g1c1-evidence/natural-full-original.jpg).

Полная локальная матрица: `tests/visual/out/g1c1-evidence/index.html`. Она содержит обработанные полные портреты, **оба** eye crops100/200/400%, old/new Density50 и Length50, Definition50, natural25/25/20, Length25/49/50/51/75/100, ridge, accepted/rejected traces и difference natural-original ×8. Полные lossless PNG занимают сотни MB и не включены в git; выбранные native crops, originals, manifests и воспроизводящие скрипты включены.

Лицензия: [Unsplash](https://unsplash.com/license). ID, размеры загрузки и SHA256: [sources.json](tests/visual/g1c1-evidence/sources.json). Имена файлов — исторические идентификаторы, **не категории**: `glasses` показывает закрытый глаз без очков; `light` имеет тёмные ресницы. Это не доказательство покрытия очков/светлых волосков. Пять реальных источников, четыре usable FaceMesh; `mascara` завершился `no_face`, отказ сохранён. Нужный набор12 категорий не собран. Существующие browser tests дополнительно используют blur/rotation/crop настоящего фото; они не заменяют разнообразия оригиналов.

Независимый critic работал отдельным агентом, смотрел код и PNG, а не только тесты:

1. Найден разрыв дуги sort-X при60° — исправлен; тест усилен.
2. Все видимые волоски `light` отклонялись disconnected — исправлена proximal connectivity. Теперь6 left tips Chromium и5 WebKit. Большие caps новых кандидатов здесь не дают: native ROI меньше224.
3. Ridge захватывал складку/границу макияжа beauty — исправлен выбор ориентации среди всех направлений; семантическая неоднозначность косметики остаётся риском.
4. Width=1 и неполные memory claims — заменены измеренным профилем и явно обозначенными typed-array метриками.
5. Крупные crop только left скрывали рабочие right-кандидаты — добавлены оба глаза.
6. Broad-band Definition — исправлен ridge-alpha; повторный critic подтвердил исчезновение широкой дуги изменений.

**Повторный итог critic для кода5ef41ed:** правые crop добавлены, `natural-right` traces следуют видимым волоскам. Новых заметных иголок, fan, двойного контура, ореолов или изменений радужки на просмотренных crop не найдено. G1c.1 менее рисованный, но полезное удлинение крайне слабо и недостаточно доказано. **LENGTH — HOLD.**

Beauty честно пропускает Length; у `natural` единственный left-tip не проходит applicator confidence, right имеет7 кандидатов. Нулевые/неудачные случаи не исключены из отчёта. Предыдущие локальные попытки остаются в `out/g1c1`, `out/g1c1-final`, `out/g1c1-verified`; для нового прогона используйте новый LASH_RUN.

## E. Performance

Изолированный Desktop Chromium L20, один worker, `--no-deps`, 864×1080:

| Режим | Median warm full render |
|---|---:|
| Lash off |75.1ms|
| Moderate50/30/40 |87.6ms|
| Full100/100/100 |88.3ms|

**Delta+12.5ms**, target+15ms: PASS в этом запуске. Новая проверка требует `ran` containing density и enhanceMs>0. На этом fixture Length пропущен, поэтому замер не доказывает стоимость активного Length. [Isolated log](tests/visual/g1c1-evidence/performance.txt). Старый baseline L20 имел `ran=""`: его PASS не считается доказательством стоимости lash обработки.

Диагностические матрицы: first call включает JIT; некоторые Chromium-прогоны выполнялись одновременно с функциональными тестами. Эти данные сравнительные, **не строгие mobile SLA**:

| Engine / источник |224 cold / median|320 median|384 median|tips224 L/R|warm900 / full pass|
|---|---:|---:|---:|---|---:|
|Chromium beauty|92.2 /59.4ms|118.2ms|137.8ms|0/0|13.3 /61.5ms|
|Chromium closed-eye (`glasses`)|13.2 /6.0ms|5.4ms|5.5ms|0/0|9.6 /8.4ms|
|Chromium light|61.7 /26.5ms|27.2ms|27.5ms|6/0|7.0 /19.5ms|
|Chromium natural|79.5 /44.3ms|44.9ms|30.9ms|1/7|14.9 /32.5ms|
|WebKit light|40 /24ms|18ms|17ms|5/0|24 /57ms|

`mascara`: no_face, не включён в timings работающего pass. Здесь warm900/full — **только applicator**, без editor grade и PNG encoding, настройки35/30/25. Full width3000 для beauty,2400 для остальных. Это не полное пользовательское время Export. Packaged PNG export проверен отдельно в обоих движках; полного high-resolution export timing gate нет.

Выбран224: на beauty320/384 дороже, Length-кандидатов по-прежнему0; на остальных native ROI уже меньше224. Автоматического улучшения качества от384 не заявляется.

Memory: `typedArrayBytes=32*w*h` включает luma и внутренние typed arrays; retainedTypedArrayBytes — ridge. При default площадь не больше50,176px: typed working не больше1,605,632bytes, дополнительно Canvas/RGBA примерно8*n. Глаза анализируются последовательно. **Это не измерение RSS/heap/GPU memory**: seeds/Set/path/evidence имеют JS overhead. Их число ограничено pixels,128 retained traces,48 tips и128 points/path. Output applicator canvases зависят от render resolution. Полный memory gate — PARTIAL.

Main-thread cold analysis занимает десятки ms, иногда больше100ms при больших caps. Worker не добавлен, поскольку кандидат пока не подтверждён визуально; jank остаётся открытым риском. Физические iPhone X/11/11 Pro Max и Android: **UNVERIFIED**. WebKit mobile — эмуляция, не физический Safari.

## F. Tests / LF1–LF24

**126 unit PASS**:120 baseline сохранены, добавлены6 новых. Полный функциональный прогон: **150 PASS,6 FAIL,2 dependent performance checks NOT RUN**. Затем L20 отдельно PASS. Промежуточный вариант имел153PASS/3FAIL; после усиления eyeliner/Definition guard эффективность на fixture стала ещё слабее. Отказы не скрыты.

[Unit](tests/visual/g1c1-evidence/unit.txt), [полный E2E](tests/visual/g1c1-evidence/e2e.txt), [Chromium manifest](tests/visual/g1c1-evidence/manifest-chromium.json), [WebKit manifest](tests/visual/g1c1-evidence/manifest-webkit.json).

FAIL:

- Chromium/WebKit `each Beauty tool and lash control changes portrait pixels`: Length difference0.
- Chromium/WebKit `maximum lash density ...`:3 заметно изменённых pixels при требовании больше10; порог сохранён.
- L6: Density changedFrac не достигает0.005.
- L22: enhancement band mean около0.0024 при требовании больше0.02.

| Gate | Результат / предел доказательства |
|---|---|
|LF1–LF2|PASS pure tests:5 размеров, scale≤1, tiny skip|
|LF3|PARTIAL: typed buffers bounded; общий heap/RSS не измерен|
|LF4–LF5|PASS topology/order/normal/crop; real-derived rotated/cropped protections PASS; rotated originals неполны|
|LF6|PASS synthetic connected evidence; реальные candidates сохранены|
|LF7|PASS synthetic horizontal liner rejected до ridge; реальное разнообразие PARTIAL|
|LF8|PASS synthetic blur и существующий real-derived blur guard|
|LF9|PARTIAL: tangent из trace; недостаточно visual validation|
|LF10|PARTIAL: fixed deterministic candidates,49/50/51 сохранены; полного flicker gate нет|
|LF11–LF12|cap/bilinear unit PASS; browser Density visibility regression FAIL|
|LF13–LF14|Existing protected-region и zero/golden checks PASS на fixtures|
|LF15|Existing preset independence PASS|
|LF16|Real MediaPipe и анализ выполняются; эффективность L22 FAIL|
|LF17|Synthetic scaling regression PASS после taper fix; existing real preview/export PASS; полный high-res visual gate PARTIAL|
|LF18–LF19|Existing switching/no-reanalysis PASS; cache dimensions/geometry/version усилены|
|LF20|Isolated Desktop L20 PASS; mobile/end-to-end timings PARTIAL|
|LF21|Existing history/styles/session/reset PASS|
|LF22|FAIL overall:6 Chromium/WebKit regressions; новый fidelity harness выполняется в обоих|
|LF23|Existing no paid inference/photo uploads PASS; новой модели/сервиса нет|
|LF24|PARTIAL: before/after артефакты сохранены, dataset/visual gate не пройдены|

`npm run build`, `npm run package:site`, `npm run check:site`: PASS. Последний packaged smoke подтвердил Chromium native и WebKit software colors, real face и PNG export. Golden-файлы не обновлялись. Safety/visibility tests не удалялись, пороги не снижались. Synthetic fixtures дополнены обязательными lowerLid/inner/ridge/connected evidence нового контракта.

Воспроизведение:

```powershell
npm test
npm run test:e2e
npm run test:e2e -- --project=chromium-performance --no-deps --grep 'L20 performance:'
node tests/visual/prepare-lash-audit.cjs
$env:LASH_RUN='g1c1-new-review-run'
node tests/visual/lash-fidelity.cjs
$env:LASH_FIXTURE='light.jpg'
node tests/visual/lash-fidelity.cjs --webkit
```

Подготовка скачивает только публичные fixtures. Renderer не отправляет фото наружу; внешний трафик browser page заблокирован. Новый LASH_RUN сохраняет предыдущие неудачные сравнения.

## G. Release

**HOLD. Версия0.5.1. Merge/deploy не выполняются при красных gates.**

- Draft [PR#5](https://github.com/Llayon/AuraGram/pull/5).
- Код/evidence: `5ef41ed760a8abbf3bf09109e3275a0932418b16`; следующие коммиты исправляют только отчёт.
- [PR Actions](https://github.com/Llayon/AuraGram/actions?query=branch%3Afeat%2Fg1c1-lash-fidelity): CI не считается пройденным; актуальный итог — в PR. Локальные gates красные независимо от CI.
- Origin/main повторно подтверждён неизменным: `b02fac3c684f2a7e3178933cb66ded925ab8bce8`.
- Нового merge SHA, published SHA и live smoke новой версии нет, поскольку релиза нет. `npm run check:live` для новой версии неприменим.
- Production: https://llayon.github.io/AuraGram/ . Ветка его не меняет. Пользовательский production SHA в baseline не выдаётся за новую независимую live-проверку.

## H. Remaining risks

Главные blockers: слабая эффективность Density на небольшом реальном источнике и почти незаметный/отсутствующий Length. Строгие dark-valley filters хуже покрывают светлые волоски; косметика/складки неоднозначны; широкие корни и тушь теряют связность. Недостаточно настоящих источников без туши, со светлыми ресницами, очками, тёмным освещением и разным реальным разрешением. Safari/WebKit software Canvas требует более широких измерений. Уменьшение рисованных штрихов и зелёные unit-тесты не закрывают G1c.1.
