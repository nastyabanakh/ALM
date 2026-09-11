# Project Rules: Astro Architecture & Fluid REM Scaling Guidelines

Цей файл містить обов'язкові інструкції та правила розробки для веб-проєктів на базі фреймворку Astro та системи Fluid REM Scaling. Усі AI-агенти (Gemini, Antigravity, Cursor, Claude тощо) зобов'язані суворо дотримуватися цих правил.

---

## 1. 🚀 ФРЕЙМВОРК ТА КОМПОНЕНТНА АРХІТЕКТУРА (ASTRO FRAMEWORK)

1. **Офіційний стек розробки:** Проєкт будується виключно на базі фреймворку **Astro** (`output: 'static'`, SSG).
2. **Single File Components (SFC) — стилі блоків строго у своїх `.astro` файлах:**
   - **Стилі секцій (`src/sections/*.astro`):** Стилі конкретної секції (`HeroSection.astro`, `AboutSection.astro`, `NewsroomSection.astro`) пишуться безпосередньо всередині блоку `<style>` у файлі цієї ж секції.
   - **Стилі атомарних компонентів (`src/components/*.astro`):** Стилі кнопок (`ButtonPill.astro`, `ButtonComposite.astro`), карток (`NewsCard.astro`, `TeamMemberCard.astro`), спейсерів (`SpaceDivider.astro`) пишуться у блоці `<style>` всередині файлу відповідного компонента.
3. **Глобальні стилі у `src/styles/` (Тільки фундамент):**
   - У папці `src/styles/` зберігаються **виключно глобальні системні стилі**, які імпортуються в `src/layouts/BaseLayout.astro`:
     - `variables.css`: Design Tokens з Figma та формула Fluid REM Scaling.
     - `reset.css`: обнулення дефолтних стилів браузера.
     - `base.css`: базові стилі для `body`, `page-wrapper`, локальні `@font-face`.
     - `typography.css`: системні класи UI Kit (`.h1`...`.h5`, `.text-l`...`.text-tiny`, `.text-btn`, `.text-color-*`).
   - **Заборонено** створювати окремі зовнішні CSS-файли для секцій і компонентів — вони мають жити всередині своїх `.astro` файлів.

---

## 2. 📏 СИСТЕМА МАСШТАБУВАННЯ (FLUID REM SCALING SYSTEM)

1. **Залізне правило конвертації: 1 px з макету Figma = 1 rem у коді CSS.**
   - Приклад: `width: 477px` -> `width: 477rem;`
   - Приклад: `padding: 20px 32px` -> `padding-top: 20rem; padding-right: 32rem; ...`
   - Приклад: `border-radius: 20px` -> `border-radius: 20rem;`
   - Приклад: `border: 1px solid ...` -> `border: 1rem solid ...`
   - Приклад: `font-size: 64px` -> `font-size: 64rem;` (або `var(--font-size-h1)`)
2. **100% Заборона px у стилях (Zero-px Rule):** Будь-які просторові одиниці (розміри, відступи, висоти, радіуси, товщина рамок `border: 1rem solid ...`, outlines) записуються виключно в `rem` без жодних винятків. Одиниці `px` дозволені суто для запису брейкпоінтів у `@media (max-width: 479px)`.
3. **Робота `:root`:** Кореневий розмір шрифту (`font-size` на `html`/`body`) динамічно розраховується за формулою:
   ```css
   font-size: calc(var(--size-container) / (var(--size-container-ideal) / var(--size-unit)));
   ```
   Завдяки цьому при будь-якій ширині екрана макет масштабується плавно та пропорційно.
4. **Адаптивна стратегія: 2-Tier Architecture:** Desktop / PC (`>479px`, ideal 1920) та Mobile (`<=479px`, ideal 390).

---

## 3. 🔤 ШРИФТИ ТА ТИПОГРАФІКА

1. **Локальні шрифти строго у `assets/fonts/` (Self-hosted WebFonts Only, No CDN):**
   - Усі шрифти зберігаються виключно в папці **`assets/fonts/`** (або `public/assets/fonts/`) у форматі WOFF2.
   - **Заборонено використовувати зовнішній Google Fonts CDN** у продакшені для максимальної швидкодії сайту.
   - Завантажуються **тільки ті накреслення (weights)**, які реально використовуються у стилях Figma.
   - **Fallback на користувача:** Якщо агент не може автоматично завантажити потрібний шрифт (платний/кастомний шрифт, відсутній у вільному доступі), агент **ЗОБОВ'ЯЗАНИЙ запитати користувача** надати WOFF2 файл для розміщення у `assets/fonts/` і не замінювати його самовільно на випадкові шрифти.
   - Підключаються через `@font-face` з `font-display: swap;`.
2. **Стилі типографіки — строго з панелі Styles у Figma (Text styles):**
   - Усі розміри, висоти рядків (`line-height`), насиченість (`font-weight`) та трекінг зчитуються 1:1 з панелі **Styles / Text styles** у Figma (наприклад: `H1 64/100`, `H2 64/110`, `H3 48/120`, `H4 32/130`, `Text L 28/150`, `Text S 20/150`, `Button 18/120`).
3. **Обов'язкове перевикористання класів типографіки (UI Kit):**
   - Усі текстові елементи отримують базові класи з `typography.css` (`<h2 class="h2 about-title">`, `<p class="text-s text-color-dark text-opacity-muted">`, `<span class="text-btn">`).
   - У стилях секцій **СУВОРО ЗАБОРОНЕНО** повторно прописувати `font-family`, `font-size`, `line-height` та `letter-spacing`.

---

## 4. 🎨 FIGMA LOCAL VARIABLES ТА ДИЗАЙН-ТОКЕНИ

1. **Старт проєкту — тільки через Design Tokens:** Перед початком верстки першого блоку обов'язково створити `variables.css` та `typography.css` за навиком `.agents/skills/figma-design-tokens-system/SKILL.md`.
2. **Єдині колекції кольорів `color` та `bg` з Figma:**
   - **Колекція `color`:** єдина колекція кольорів для тексту, векторних іконок, рамок та акцентів (`--color-accent`, `--color-brand`, `--color-black`, `--color-dark`, `--color-white`, `--color-light`). Немає окремого поділу на text/color — все є `color-*`.
   - **Колекція `bg`:** для фонів секцій, панелей та карток (`--bg-accent`, `--bg-brand`, `--bg-black`, `--bg-dark`, `--bg-white`, `--bg-light`).
3. **Обов'язковість ПК та Мобільної версії для кожного Variable:**
   - Для кожної Variable (Color, Bg, Gaps, Space, Radius, Grid) зчитуються обидва режими (Modes) з Figma:
     - **Desktop mode** -> записується в `:root`.
     - **Mobile mode** -> записується у `@media (max-width: 479px)`.
4. **Токени простору та обов'язковість Variables для Margin / Padding:**
   - **`var(--gap-*)` (`3xs`...`2xl`):** для ВСІХ відступів — `gap`, `margin` та `padding`.
   - **Стратегія підбору токенів:**
     - **Точний збіг:** якщо значення з макету Figma збігається з токеном (наприклад: `4rem` -> `--gap-3xs`, `12rem` -> `--gap-2xs`, `16rem` -> `--gap-xs`, `24rem` -> `--gap-s`, `32rem` -> `--gap-p`, `40rem` -> `--gap-r`, `64rem` -> `--gap-t`, `80rem` -> `--gap-m`, `96rem` -> `--gap-l`, `120rem` -> `--gap-xl`, `160rem` -> `--gap-2xl`) — **ОБОВ'ЯЗКОВО** застосовувати токен `var(--gap-*)`.
     - **Близький збіг:** якщо значення дуже схоже / наближене до токена (наприклад: `20rem` -> `--gap-s`, `60rem` -> `--gap-t`, `30rem` -> `--gap-p`, `10rem` -> `--gap-2xs`) — **ОБОВ'ЯЗКОВО** підтягувати найближчий токен `var(--gap-*)`.
     - **Кастомні відступи:** тільки якщо відступ є фундаментально унікальним або специфічним для даного макету (наприклад: `118rem`, `240rem`, `300rem`, `557rem`) — записувати пряме значення в `rem`.
   - **`var(--space-*)` (`xs`...`l`):** для міжсекційних розділювачів.
   - **`var(--radius-*)` (`xs`...`round`):** для заокруглень кутів (за аналогічною стратегією точного або близького збігу).

---

## 5. 📦 ПРАВИЛО АТОМАРНИХ LONGHAND-ВЛАСТИВОСТЕЙ (BOX MODEL & POSITIONING)

1. **Сувора заборона багатозначних скорочень (Zero Multi-Value Shorthands):**
   - Візуальні редактори та панелі стилів (Webflow Designer Style Panel, Spacing Box Model, Position Widget) зіставляють параметри виключно з атомарними longhand-властивостями.
   - Будь-який запис скорочень з 2, 3 або 4 значеннями автоматично потрапляє у розділ *Custom properties*, а у візуальних віджетах Spacing/Position залишаються `0`.
2. **Відступи (Padding та Margin) — Longhand + Variables:**
   - **СУВОРО ЗАБОРОНЕНО:** `padding: 60rem 40rem 70rem 40rem;`, `padding: 20rem 32rem;`, `margin: 0 auto;`, `margin: -40rem auto 20rem;`.
   - **ОБОВ'ЯЗКОВО РОЗПИСУВАТИ ОКРЕМО З ТОКЕНАМИ:**
     ```css
     padding-top: var(--gap-*); /* або ...rem; для кастомних */
     padding-right: var(--gap-*);
     padding-bottom: var(--gap-*);
     padding-left: var(--gap-*);

     margin-top: var(--gap-*);
     margin-right: var(--gap-*); /* або margin-right: auto; */
     margin-bottom: var(--gap-*);
     margin-left: var(--gap-*); /* або margin-left: auto; */
     ```
3. **Позиціонування (Positioning / Coordinates):**
   - **СУВОРО ЗАБОРОНЕНО:** скорочення `inset: 0;` або `inset: 10rem 20rem;`.
   - **ОБОВ'ЯЗКОВО РОЗПИСУВАТИ:**
     ```css
     top: 0;
     right: 0;
     bottom: 0;
     left: 0;
     ```
4. **Асиметричні кути (Border Radius):**
   - Якщо радіус задається не для всіх кутів однаково, **заборонено** запис `border-radius: 0 0 50rem 50rem;`.
   - **Обов'язково писати:**
     ```css
     border-top-left-radius: ...;
     border-top-right-radius: ...;
     border-bottom-right-radius: ...;
     border-bottom-left-radius: ...;
     ```
5. **Окремі рамки (Borders):**
   - Для рамок окремих сторін використовувати `border-top: ...;`, `border-bottom: ...;`, `border-left: ...;`, `border-right: ...;` або їх компоненти:
     ```css
     border-bottom-width: 1rem;
     border-bottom-style: solid;
     border-bottom-color: rgba(...);
     ```

---

## 6. 🧠 ЖУРНАЛ ПОМИЛОК (`.gemini/LEARNINGS.md`)

1. **Pre-flight Check:** Перед виконанням будь-якої нової задачі агент зобов'язаний прочитати файл `.gemini/LEARNINGS.md`.
2. **Auto-Logging виправлень:** Щоразу, коли користувач вказує на помилку або вносить корективу, агент негайно фіксує випадок у `.gemini/LEARNINGS.md`.
3. **Комунікація:** Усі звіти, плани та пояснення формуються **виключно українською мовою**.
