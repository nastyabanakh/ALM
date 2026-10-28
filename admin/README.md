# Локальна перевірка ALM CMS

ALM зараз переходить на нове ядро CMS. Універсальна система й етапи переходу описані в [документації](../docs/README.md).

## Запуск без GitHub

1. У корені проєкту створіть `.env.local` за прикладом `.env.example`. Задайте власні `ADMIN_PASSWORD` і `JWT_SECRET`. Файл `.env.local` ігнорується Git. На цій машині файл уже створено з випадковими значеннями; щоб побачити локальний пароль, відкрийте `.env.local` у своєму редакторі.
2. Виконайте `npm install`, якщо залежності ще не встановлено.
3. Запустіть `npm run dev:cms`.
4. Відкрийте `http://127.0.0.1:3001/admin/` для редактора статичного контенту ALM або `http://127.0.0.1:3001/cms/` для нового редактора статей і портфоліо. Для входу використайте `ADMIN_USER` і `ADMIN_PASSWORD` із `.env.local`.

Локальний сервер слухає лише `127.0.0.1`. Його API примусово працює в локальному режимі й не надсилає зміни до GitHub, навіть якщо у середовищі є `GITHUB_TOKEN`. Поточний редактор зберігає серверну чернетку і при натисканні «Опублікувати» змінює локальний запис `src/content/pages/00000000-0000-4000-8000-000000000001.json`; Astro dev покаже зміну після оновлення сторінки. Віддалений деплой ще не підключено. Перед тестом публікації перевірте `git status` і зробіть копію потрібного контенту або поверніть тестові зміни через Git.

Для швидкої перевірки без публікації увійдіть і змініть поле: чернетка збережеться на сервері в `.cms/`. Панель праворуч показує поточну чернетку до публікації. Зміна поля одразу оновлює прев’ю; подвійний клік по підключеному до CMS тексту дозволяє змінити його прямо на сторінці. Такі правки повертаються у форму й серверну чернетку. Опублікований сайт оновлюється лише після натискання «Опублікувати».

На головній сторінці тексти, посилання, медіа та дані карток читаються з одного запису `pages`; подвійний клік і поля зліва змінюють його чернетку. Секції мають стабільні `data-cms-path`, тому після локальної публікації Astro рендерить ці значення в HTML. Для інших статичних маршрутів перехідні текстові накладки ще можуть використовуватися. Перемикач «Кліки: вимкнено» блокує дії кнопок і посилань під час редагування.

Список секцій зверху та поля зліва створюються з поточної сторінки в прев'ю й запису її контенту. Зміни в структурі сторінки з'являються після оновлення прев'ю. Ліва вузька панель перемикає Admin, CMS, Media та Page settings. Для полів головної, які були перенесені раніше, у `preview-fields.js` залишилися селекторні прив'язки; нові поля використовують стабільні `data-cms-path`. Стандарт описано в `docs/CMS_CONTENT_STANDARD.md`.

Налаштування SEO та локальна історія доступні через кнопку ⚙ у верхній панелі. Автоматичні атрибути зображень і посилань теж зберігаються як накладки; для SEO потрібен наступний етап із серверним рендерингом і точковим записом у код.

Новий редактор `/cms` уже зберігає чернетки в локальній папці `.cms/` (вона ігнорується Git). Кнопка «Опублікувати локально» перевіряє запис і створює файл у `src/content/posts/` або `src/content/projects/`. Це локальна публікація для розробки: перевірте сторінку `/blog/` або `/portfolio/` та запустіть `npm run build`. До готовності віддаленого адаптера новий редактор не публікує у GitHub.

Поле «Адреса» приводиться до URL-формату: наприклад, `test adress` стає `test-adress`. «Прев'ю чернетки» доступне після збереження; «Відкрити опубліковану сторінку» з'являється тільки для готової публічної сторінки.

## Що перевіряється окремо пізніше

GitHub-запис і статус хостингового деплою потребуватимуть тестового віддаленого репозиторію та відповідного середовища. Підключати їх для початкового локального циклу не потрібно. Робочий `origin` уже існує, але локальні тести не повинні писати в нього.

## Безпека

У новому коді немає робочого пароля чи ключа сесії за замовчуванням. Якщо `ADMIN_PASSWORD` або `JWT_SECRET` відсутні, API повертає помилку налаштування. Для продакшену задайте їх та доступ до Git у серверних змінних середовища з мінімальними правами. Не додавайте `.env.local` у репозиторій.


## Вибір компонентів і CMS списків

У `/admin/` секції відкривають картки елементів замість довгого списку полів. Виберіть картку кнопки або натисніть її на canvas: зліва відкриються тільки її властивості. Зображення вибираються аналогічно; кнопка Replace image відкриває Media. Зелена рамка відповідає компоненту, синя — зображенню, фіолетова — колекції. Фіолетова мітка CMS над списком відкриває його записи. Панель параметрів і сайт у canvas прокручуються незалежно; оболонка редактора займає висоту вікна.

Кнопка CMS у лівій панелі відкриває масиви поточного запису сторінки. Відкрийте FAQ чи інший список, натисніть картку й редагуйте її поля. Перетягніть картку за хендл зліва, щоб змінити порядок: місце вставки відображається під час руху. Хендл також підтримує клавіші вгору/вниз. Зміни проходять через наявну чернетку й публікацію; доступні Undo/Redo. Створення та видалення записів у цій вкладці ще не додані. Для окремих записів статей і портфоліо доступне посилання Articles & portfolio.


## Media drafts

Media is a visual file manager with a draft/publish boundary. Rename, move, folder edits, deletion, upload, replacement and alt changes are saved as a persistent draft. A single chronological Undo/Redo timeline includes both Media and content changes, regardless of the selected view. Media shows the planned path separately from the published path. One shared pending indicator and the top-level Publish action apply to the entire project.

The shared Publish applies real file changes, rewrites known references, and publishes every pending page/article/portfolio record together. Per-module publishing is disabled. Used files cannot be deleted until references are removed or replaced. File conflicts, stale revisions and ambiguous computed references block the operation. Successful publication resets the draft history to a new baseline and retains recovery backups.

New uploads and replacements have authenticated draft previews; public file bytes stay unchanged before publication. Video fields have real playback controls, path/error information and type-specific pickers. Changing a source reloads the video; unrelated edits do not restart it.


## Shared publication

The top-level Publish flushes open forms and shows a project summary. All pending CMS records are validated before publication. The server checks the reviewed draft revisions and serializes publication, with a recovery snapshot of project sources, assets and draft state. If a later step fails, the snapshot restores the pre-publication project. Media and CMS no longer expose independent publication/discard controls.
