# 🚀 Astro Frontend Starter Pack (Fluid REM Scaling & Figma Tokens)

Цей пакет містить повний набір інструментів, правил, навиків (skills) та шаблонів коду для швидкого та безпомилкового старту будь-якого нового веб-проєкту на базі фреймворку **Astro** та системи **Fluid REM Scaling (1 px Figma = 1 rem CSS)**.

---

## 📂 Структура Starter Pack

```
starter-pack/
├── GEMINI.md                          # Головний файл правил для AI-агентів (Astro SFC, Zero-px, Fonts, UI Kit)
├── README.md                          # Цей посібник запуску проєкту
├── .gemini/                           # Системна папка Gemini
│   └── LEARNINGS.md                   # Журнал помилок та виправлень (Auto-Logging)
├── .agents/skills/                    # Спеціалізовані навики розробки для агентів
│   ├── figma-design-tokens-system/    # Екстракція токенів, Text Styles та Variables з Figma
│   └── fluid-responsive-system/       # 2-Tier флюїдна адаптивність (ПК >479px, Моб <=479px)
└── templates/                         # Стартові файли кодової бази
    ├── astro/                         # Готовий каркас Astro проєкту
    │   ├── astro.config.mjs           # Конфігурація Astro (output: static)
    │   ├── package.json               # Залежності та npm скрипти
    │   └── src/
    │       ├── layouts/BaseLayout.astro # Базовий Astro Layout
    │       └── pages/index.astro      # Головна сторінка Astro
    ├── fonts/                         # Папка для локальних WOFF2 шрифтів (assets/fonts/)
    ├── css/
    │   ├── variables.template.css     # Шаблон Design Tokens з категоріями color, bg, gaps, space (ПК + Мобілка)
    │   ├── reset.css                  # Обнулення дефолтних стилів браузера
    │   ├── base.css                   # Базові правила body, page-wrapper, space-розділювачі
    │   ├── typography.css             # UI Kit типографіки (.h1-.h5, .text-l-.text-tiny, .text-btn)
    │   └── main.css                   # Головний файл імпорту глобальних стилів
    ├── js/
    │   └── main.js                    # Базовий скрипт мобільної навігації
    └── scripts/
        └── download_fonts.py          # Автоматичний завантажувач WOFF2 шрифтів у assets/fonts/
```

---

## 🧩 Компонентна архітектура в Astro (Single File Components)

Усі компоненти та секції будуються за принципом **Single File Components (HTML + JS + CSS в одному `.astro` файлі)**:

### 1. Атомарні компоненти (`src/components/*.astro`):
* Кнопки, картки, розділювачі (`ButtonPill.astro`, `NewsCard.astro`, `SpaceDivider.astro`).
* Стилі компонента пишуться **безпосередньо у блоці `<style>` всередині цього ж `.astro` файлу**:
  ```astro
  ---
  const { label, href } = Astro.props;
  ---
  <a href={href} class="btn-pill">{label}</a>

  <style>
    .btn-pill {
      height: 39rem;
      border: 1rem solid var(--color-dark);
      border-radius: var(--radius-round);
      padding: var(--gap-xs) var(--gap-s);
    }
  </style>
  ```

### 2. Секції сайту (`src/sections/*.astro`):
* Великі смислові блоки (`HeroSection.astro`, `AboutSection.astro`, `NewsroomSection.astro`).
* Стилі секції пишуться **всередині `<style>` у відповідному `Section.astro` файлі**.
* Якщо секція потрібна на іншій сторінці — вона просто імпортується як готовий блок зі своїми стилями.

### 3. Глобальні стилі (`src/styles/`):
* У папці `src/styles/` знаходяться **тільки системні файли**:
  - `variables.css` (токени та скейлінг).
  - `reset.css` (обнулення).
  - `base.css` (body, `@font-face`).
  - `typography.css` (UI Kit класи `.h1`...`.h5`, `.text-s`, `.text-btn`).
* Вони імпортуються один раз у `BaseLayout.astro`.

---

## 🧭 Покроковий алгоритм запуску нового Astro проєкту (Kickoff Sequence)

> [!IMPORTANT]
> **5 Залізних правил старту:**
> 1. **Фреймворк Astro (SFC):** Стилі компонентів та секцій пишуться безпосередньо у блоках `<style>` всередині відповідних `.astro` файлів.
> 2. **Локальні шрифти строго у `assets/fonts/` (Self-hosted WebFonts Only):** Шрифти скачуються виключно в папку **`assets/fonts/`**, без зовнішніх Google Fonts CDN. Завантажуються **лише ті накреслення**, які реально потрібні проєкту. **Якщо шрифт не знайдено автоматично — агент зобов'язаний запитати користувача.**
> 3. **Типографіка — строго з панелі Styles у Figma (Text styles):** Значення `font-size` та `line-height` зчитуються 1:1 з панелі `Styles / Text styles` (наприклад `H1 · 64/100`, `H2 · 64/110`, `H4 · 32/130`, `Text S · 20/150`, `Button · 18/120`).
> 4. **Колірна структура `color` та `bg` з Figma:** Є дві колекції: `color` (для тексту, векторних іконок, рамок та акцентів: `--color-accent`, `--color-brand`, `--color-dark`, `--color-white`) та `bg` (для фонів: `--bg-accent`, `--bg-brand`, `--bg-dark`, `--bg-light`).
> 5. **Variables (ПК + Мобілка) — строго з Figma Local Variables:** Усі змінні (color, bg, space, gaps, radius, grid) тягнуться для обох режимів (Desktop mode у `:root` та Mobile mode у `@media max-width: 479px`).

```
КРОК 1: Ініціалізація GEMINI.md, .gemini/LEARNINGS.md, .agents/skills/ та Astro каркасу
   ⬇
КРОК 2: Завантаження потрібних накреслень шрифтів у assets/fonts/ (download_fonts.py або запит у користувача)
   ⬇
КРОК 3: Аналіз Figma Local Variables (color, bg, space, gaps, radius) та Text styles
   ⬇
КРОК 4: Формування variables.css, typography.css та :root скейлінгу
   ⬇
КРОК 5: Модульна розробка компонентів та секцій зі стилями всередині .astro файлів
```

---

### Крок 1. Ініціалізація Astro структури
1. Скопіюйте `GEMINI.md`, папку `.gemini/` та папку `.agents/` у корінь проєкту.
2. Скопіюйте файли з `templates/astro/` (`astro.config.mjs`, `package.json`, `src/layouts/BaseLayout.astro`, `src/pages/index.astro`).
3. Запустіть встановлення залежностей:
   ```bash
   npm install
   ```

---

### Крок 2. Локалізація шрифтів у `assets/fonts/`
1. Визначте сімейства та накреслення на основі Text Styles у Figma.
2. Запустіть скрипт:
   ```bash
   python3 templates/scripts/download_fonts.py --family "Ваш Шрифт" --weights 400,700
   ```
   Файли WOFF2 автоматично збережуться в `assets/fonts/`.
3. **Якщо шрифт платний або кастомний:** агент звертається до вас із запитом:
   > *"Шрифт [Назва] не знайдено у відкритих реєстрах. Надайте, будь ласка, файл .woff2 для збереження в assets/fonts/"*.
4. Підключіть їх через `@font-face` з `font-display: swap;` у `src/styles/base.css`.

---

### Крок 3. Зчитування Figma Variables та Text Styles
Використовуйте навик `.agents/skills/figma-design-tokens-system`:
1. З панелі **Styles / Text styles** зчитайте параметри `font-size` та `line-height`.
2. З панелі **Local Variables** зчитайте обидва режими (Desktop + Mobile) для `color`, `bg`, `space`, `gaps`, `radius`, `grid`.

---

### Крок 4. Заповнення `variables.css` та `typography.css`
1. Заповніть `src/styles/variables.css` на основі `templates/css/variables.template.css`.
2. Заповніть `src/styles/typography.css` на основі `templates/css/typography.css`.
3. Усі просторові розміри перевіряються за формулою `1 px Figma = 1 rem CSS`.

---

### Крок 5. Модульна верстка в Astro
1. Створюйте атомарні елементи у `src/components/*.astro` зі своїми стилями всередині `<style>`.
2. Створюйте секції у `src/sections/*.astro` зі своїми стилями всередині `<style>`.
3. Зберігайте чистий 2-Tier адаптив: Desktop (`>479px`) та Mobile (`<=479px`).
