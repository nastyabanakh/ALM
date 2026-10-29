# ALM Admin — дизайн-система

Оновлено 28 жовтня 2026 року. Інтерактивний UI Kit: `/admin/ui-kit.html`, пункт **UI Kit** унизу сайдбара.

## Напрям

Біла навігація та темна робоча область — пряма вимога користувача. Всі екрани, поля, попапи й стани належать одній системі. Основна дія біла; колір використовується для значення, а не декору. Інтерфейс англійською, короткі назви замість постійних інструкцій.

Це реалізація актуальних практик станом на жовтень 2026 року. Підходи 2027 року ще не можна перевірити; дизайн підтримує подальше розширення без вигаданих «трендів майбутнього».

## Що взято з дослідження

- [Linear, 12 березня 2026](https://linear.app/now/behind-the-latest-design-refresh): передбачуване розміщення дій та різна візуальна вага контенту й допоміжної навігації. У нас постійний верхній рядок, одна публікація, компактні допоміжні інструменти. Білий сайдбар збережено відповідно до вимоги користувача.
- [Framer 3.0, 16 червня 2026](https://www.framer.com/blog/framer-3/): прямий контроль над canvas і спільна робота з компонентами, CMS та налаштуваннями. У нас вибір елемента та його параметри залишаються поруч із прев’ю; керування контентом використовує спільну історію.
- [NNGroup: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): рідкісні налаштування відкриваються за потреби. Custom code, технічний ключ змінної та пояснення успадкування компонентів перенесені в розкривні блоки.
- [W3C: розмір цілей керування](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): враховано мінімальні розміри й відстані. Основні кнопки — 36, компактні — 28, іконки-кнопки — 32 умовні одиниці; наведення доповнюється станом клавіатурного фокусу. Це не заява про повну сертифікацію WCAG.

## Екрани та пріоритети

| Екран | Основний сценарій | Розміщення |
|---|---|---|
| Page editor | Вибрати секцію/об’єкт і змінити параметри | Компактний інспектор, регульована ширина, canvas праворуч |
| CMS, огляд | Знайти колекцію або сторінки | Лівий інспектор і canvas праворуч; Collections / Pages лише на кореневому рівні |
| CMS, список | Знайти, відкрити, впорядкувати записи | Лівий інспектор і canvas праворуч; пошук і компактні рядки |
| CMS, запис | Редагувати конкретний запис | Інспектор + canvas; для сторінок canvas з’являється після Preview draft |
| Media | Знайти файл, відредагувати, вибрати кілька | Папки ліворуч, сітка по центру, властивості праворуч; фільтр типу файлів |
| Const | Змінити спільне значення | Спочатку згортані групи зі списками; натискання відкриває деталі з All Const. Drag and drop змінює порядок і групу |
| Page settings | Налаштувати сторінку й метадані | General, SEO, Open Graph; Custom code згорнуто |
| UI Kit | Переглянути реальні правила і стани | Основи, інтерактивні приклади, повний довідник токенів |

Історія та Publish завжди зверху й не змінюють значення між вкладками. Масові дії Media показуються після вибору файлів. Неактивні/невикористані фото мають меншу opacity та окремий індикатор, а не лише зміну кольору. Створення папки та видалення константи використовують стилізовані діалоги зі зрозумілими діями.

Quick find відкривається кнопкою Find або ⌘K / Ctrl+K. Пошук веде до вкладок і секцій поточної сторінки. Стрілки переміщають вибір, Enter відкриває, Escape закриває. На вузькому екрані інспектор і прев’ю перемикаються верхньою кнопкою; налаштування й Media перебудовують колонки.

## Джерело істини дизайну

Живий `/admin/ui-kit.html` — джерело істини дизайну адмінки. Перед розробкою враховувати його компоненти, токени й стани. Якщо користувач просить змінити дизайн, одночасно оновлювати спільну реалізацію та приклади/стани в UI Kit.

Кожен елемент структури має легку обводку картки; Link використовує chain-link. Canvas показує обводку й handle з іконкою для звичайних елементів і компонентів, а також CMS і Const. Хлібні крихти показують тільки секції й групи з інспектора, без DOM-wrapper. Back та крихти залишаються в редакторі. CMS відкривається з картки колекції або через пункт CMS у навігації.

Const — глобальні змінні всього сайту, доступні на кожній сторінці й у CMS-записах. Зміна одного визначення оновлює всі зв’язані використання після спільного Publish.

## Джерело стилів

- `public/admin/design-tokens.css` — єдине місце визначення кольорів, шкал типографіки, відступів, радіусів, розмірів контролів, колонок, тіней, прозорості, анімацій та шарів.
- `public/admin/admin-ui.css` — спільні стилі адмінки. Попередній багатошаровий inline CSS видалений.
- `public/admin/ui-components.mjs` — спільні кнопки, badges, картки елементів, іконка компонента, навігація, disclosure, empty state, toast, діалог і Quick find.
- `public/admin/ui-kit.html`, `ui-kit.mjs`, `ui-kit.css` — живий каталог на тих самих стилях і базових компонентах. Довідник змінних генерується безпосередньо з токен-файла.

### Три рівні токенів

1. Примітиви: `--ui-neutral-950`, `--ui-purple-300` тощо. Літеральні кольори задаються лише тут.
2. Семантичні ролі: `--ui-color-canvas`, `--ui-color-text`, `--ui-color-const`, `--ui-color-component`, `--ui-color-override`.
3. Компонентні параметри: `--ui-control-md`, `--ui-rail-width`, `--ui-inspector-width`, `--ui-media-detail-width` та інші.

Використовувати роль, а не безпосередньо колір: `color: var(--ui-color-muted)`. Новий колір спочатку додається в токени. Для станів також не додавати HEX/RGB безпосередньо в компоненти. `currentColor` в SVG успадковує відповідну роль.

### Типографіка й ритм

Шрифт інтерфейсу — системний sans; код і шляхи — локальний JetBrains Mono. Ролі: heading 24, title 18, body 13, label/caption 12, дрібні службові підписи 10–11. Є спільні weight, line-height і tracking. Класи: `.ui-heading`, `.ui-title`, `.ui-body`, `.cap`, `.ui-caption`, `.ui-eyebrow`.

Шкала відступів: 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64. Застосовувати `--ui-space-*` для gap/padding/margin. Радіуси — 4/6/8/12/16, оболонка навігації — 28. Власні розміри складних компонентів також задаються токенами, коли їх треба повторно використовувати.

Адмінка використовує домовлену в проєкті rem-шкалу з базою 1 CSS pixel. Canvas сайту має власний документ і масштаб. Геометрія рамок, drag-плейсхолдерів та координат меню обчислюється з DOM у CSS pixels; це вимірювання, а не незалежна дизайн-шкала. У прев’ю підключаються лише визначення токенів кольору: reset і типографіка адмінки не застосовуються до сайту.

### Семантика станів

| Роль | Використання |
|---|---|
| Нейтральна біла | Основна дія, вибір, фокус |
| Фіолетова | CMS, колекції та їхні рамки на canvas |
| Оранжева | Глобальні Const, токени тексту та пов’язаний hover |
| Зелена | Повторно використовуваний компонент |
| Синя | Прості елементи: текст, лінк, медіа; також локальне перевизначення і Reset |
| Бурштинова | Попередження, невикористаний файл, неопубліковані зміни |
| Червона | Помилка або дія видалення |

Disabled, hover, selected, focus-visible, empty, loading і error мають окремі стилі. У діалогах фокус утримується всередині, Escape закриває, після закриття фокус повертається до ініціатора. Під час незворотного етапу публікації діалог блокує закриття.

## Незмінні продуктові правила

Джерело істини — код і файли сайту. Редизайн не створює нове сховище контенту. Media, CMS, Const, компоненти й налаштування використовують одну чернетку, одну історію Undo/Redo і один Publish. Файлові операції застосовуються при спільній публікації. Публічний дизайн сайту не змінюється.

## Попередня перевірка реалізації

Наведені нижче результати стосуються попереднього редизайну. Зміни навігації, кольорів і hover handles після уточнення користувача внесені без запуску тестів згідно з чинними правилами проєкту.

Перевірено 28 жовтня 2026 року в окремій копії проєкту:

- 66/66 браузерних сценаріїв адмінки: редагування, навігація, групування CMS, компоненти/override/reset, Const, відео, Media, хронологічна історія та спільна публікація.
- 122/122 перевірки логіки/API: автентифікація, чернетки, файли/посилання, конфлікти ревізій та відкат транзакції.
- 39/39 синтаксичних перевірок; production build успішний.
- Додатковий візуальний сценарій: біла навігація/темне тло, Quick find із клавіатури, фільтр типів Media, створення папки та Undo, всі основні екрани, діалоги та Const у UI Kit, ширини 1600 і 390.
- Контракт дизайн-системи: у 19 файлах адмінки немає літеральних HEX/RGB/HSL поза токен-файлом; усі статичні посилання на змінні існують; CSS використовує шкали відступів і розмірів тексту. Локальні іконки перевірені на наявність.

Тести й скриншоти залишені в сусідній ізольованій `.qa-admin-audit-20261028`, а не в продуктовому коді. Для перевірки редизайну тестові очікування оновлені лише там, де інтерфейс змінено навмисно: короткий статус Published, згорнутий Custom code і стилізований діалог видалення константи. Дані робочого сайту під час тестів не публікувалися.

## Уточнення інспектора — 28 жовтня 2026

CMS, включно з оглядом, списками й параметрами запису, використовує ліву панель поряд із canvas. Елементні й вкладені картки мають проміжок `--ui-space-4`. URL розташований у центральній колонці toolbar між двома однаковими бічними колонками; на вузькому canvas URL ховається, щоб зберегти доступність керування.

Назва розділу та його керування — Const. Не показувати текст «Global variable · Updates connected fields across every page.». Вхід через пункт Const показує список без автоматичного вибору. Натискання картки відкриває тільки її параметри, All Const повертає список. Явний перехід із токена відкриває потрібний Const.

Групи мінімалістичні, зі згортанням, кількістю елементів і редагуванням назви. Видалення групи переносить її Const в Ungrouped. Drag grip змінює порядок і переносить Const між групами, в тому числі порожніми. Альтернатива: Alt + стрілки для порядку, Group і Move up / Move down у деталях. Групи та порядок зберігаються в `content.editorSettings.constGroups` зі спільною історією та Publish; глобальні ключі й токени Const не змінюються. Стан згортання є локальним станом інтерфейсу. UI Kit має інтерактивний приклад того самого `const-browser.mjs`.

## Єдиний патерн сортування та станів

`public/admin/sortable.mjs` — спільна реалізація pointer-перетягування для CMS-записів, Const і списків Collections/Pages: floating row, анімований placeholder, автопрокрутка біля країв, pointer capture, скасування через Escape/pointercancel. Стрілки ↑/↓ на grip змінюють порядок. Const і каталоги CMS використовують один згортаний browser; організація каталогів зберігається окремо для Collections/Pages у `editorSettings.cmsGroups`, зі спільною історією та Publish. Зміна порядку каталогу не змінює записи всередині колекцій.

Back використовує ту саму quiet-кнопку, що Cancel: без фону й обводки за замовчуванням, фон на hover. Перемикач сторінки містить page-icon усередині та окремий простір для chevron. Прості елементи в інспекторі мають нейтральні іконки; синя семантика рамок canvas залишається. Назва перевизначеного параметра має синій фон; Alt + click на ній скидає параметр. Reset використовує локальну rotate-ccw іконку. UI Kit містить інтерактивні приклади всіх цих станів.

Editor запитує структуру через CMS_REQUEST_STRUCTURE після load/ready і повернення з іншої вкладки. При виході з CMS preview відновлюється адреса сторінки з cms-preview=1. Запити мають обмежені повтори; відсутня відповідь показує помилку та Reload preview, а не нескінченне завантаження.

## Hover, link display та дії під списком

Canvas hover має одну overlay-рамку. Нативні outline елементів, вкладених полів і selected-станів тимчасово приглушуються; hover Const належить тільки Const-affordance. CMS-рамка ховається на час hover конкретного елемента.

Для типів Phone/Email поле показує тільки номер/адресу або Const без протоколу/формату. Збережене посилання зберігає tel:/mailto:. Спільні `backAction` та `groupFooter` визначають Back і New group: іконка вирівняна з лівим краєм контенту, hover має повну область кнопки. New group стоїть після списку під роздільною лінією в Const, Collections і Pages, включно з UI Kit.

Після завантаження основного контенту поля й навігація доступні одразу. Media та project status завантажуються паралельно. Поки відновлюється історія, недоступні тільки Undo/Redo; нові дії зберігаються поверх відновленої історії. Ідентичні відповіді CMS_STRUCTURE не перемальовують інспектор і не забирають перший клік/фокус. Початковий hash застосовується до фонової гідратації, щоб не перевизначати подальшу навігацію користувача.

### Семантика floating row та єдина рамка

Тип CMS/Const записується безпосередньо на картці (`data-kind`), а не успадковується лише від browser. Тому перенесення floating row у body не змінює фіолетову CMS-іконку на оранжеву Const.

Нативні hover-outline прибрані з preview-fields/static-text. Один overlay є власником hover-рамки. При видимому element/Const overlay CSS :has тимчасово приглушує нативні selected/editing-outline та CMS-рамку. Const overlay має пріоритет над generic element overlay. Власник визначається реальною видимістю frame, без залежності від порядку pointer-подій.

## Уточнення інспектора, завантаження та папок

- CMS List/Page — компактна незмінна позначка. У корені CMS заголовок і Collections/Pages розташовані одним рядком, якщо вистачає ширини, і переносяться на вузькій панелі.
- Пошук починається з іконки `compactSearch`; натискання відкриває поле, Escape очищає й закриває, порожнє поле закривається після втрати фокусу.
- Редагування групи видно лише на hover/focus рядка summary. Рівномірні padding і роздільники, лічильники вирівняні праворуч без резерву місця під дії; на hover/focus кнопка зсуває лічильник ліворуч.
- Усі звичайні select мають власний chevron із відступом справа. Back компенсує верхній padding так само, як лівий.
- This tab/New tab — `targetToggle` усередині тієї самої Link-групи, без окремого Open in. Компонентний target зберігається як властивість компонента.
- Breadcrumbs містять секцію, CMS List, CMS item і шлях елемента; CMS pages також показують колекцію та запис. У Editor натискання CMS breadcrumb відкриває відповідний рівень у цьому ж інспекторі; Back між елементами теж лишається в Editor.
- Loading — спільний анімований `loading()` із доступною назвою; Media, структура редактора та CMS використовують його. Для reduced motion швидкість зменшена.
- `folderTree` має окремий chevron лише для папок із дочірніми папками; назва вибирає папку, chevron незалежно згортає гілку. Стан згортання локальний. Rename/F2/context menu збережені.

Живий UI Kit містить ті самі компоненти й приклади. Технічний маркер сайту: data-cms-technical, контракт у CMS_CONTENT_STANDARD.md та AGENTS.md.

## CMS parents у вкладці Editor

Для вибраного елемента запису зберігати контекст page/section/collection/index. Back проходить вкладені батьківські елементи цього запису, потім показує CMS item (поля й картки елементів), далі CMS list (картки записів із пошуком), далі секцію. Ці рівні рендеряться у звичайному Editor inspector, без переходу у вкладку CMS. Breadcrumbs використовують ті самі переходи. Явна CMS-картка колекції у структурі секції, як і раніше, може відкрити CMS workspace.

Іконки: list — database, item — file-text, обидва фіолетові, включно з breadcrumbs і картками. Контекст скидається при зміні сторінки/секції або виборі статичного елемента. UI Kit містить інтерактивний приклад ланцюжка Back.

## Центрований loader із п’яти квадратів

Спільний loading() показує п’ять квадратів: вони послідовно заповнюються білим знизу вгору, коротко залишаються заповненими й одночасно починають новий цикл. Розмір, проміжок і тривалість задані токенами ui-loader-*. Це невизначений стан очікування, а не відсоток фактичного прогресу.

Media loader центрується горизонтально й вертикально в доступній робочій області під header, праворуч від sidebar. Loader інспектора так само центрується в його панелі; окремий дубль зверху в section tabs прибраний. UI Kit має центрований preview того самого компонента. Accessible role/status та назва збережені; reduced motion показує заповнені квадрати без анімації.

### Вирівнювання груп та CMS header

Group options не займають місце у звичайному стані: display:none, на hover/focus summary — inline-grid. Лічильник стоїть на правому краї; поява кнопки зсуває його ліворуч. Ungrouped не має spacer. Flex:1 належить лише const-group-name, а не всім span у summary. У cms-index-heading прибраний власний нижній margin перемикача, щоб Collections/Pages і заголовок мали спільний вертикальний центр. UI Kit використовує ті самі виправлені компоненти.

## Спільні CMS list та item

Editor і CMS більше не мають двох реалізацій list/item для колекцій контенту. `collection-views.mjs` надає collectionListView (sortable record rows, compact search, New item) і collectionItemView (Editor-картки/поля, CMS item badge, Delete item унизу). Одна renderCollectionView отримує лише контекст навігації вкладки.

New item створює запис зі структурою полів колекції, новою ідентичністю та введеною назвою; медіа лишається доступним для заміни в його полях. Delete item виконується всередині item після підтвердження. Створення/видалення/порядок входять у спільну чернетку, Undo/Redo і Publish. Власні indexed linkSettings перенумеровуються; налаштування видаленого item прибираються. Відоме зовнішнє посилання на сторінку item блокує видалення до виправлення цього лінка.

Після структурної зміни поля читаються з актуальних даних, а не старих компонентних descriptors DOM. Ревізія структури зберігається в editorSettings, тож reload чернетки не повертає застарілі bindings. Шаблон порожньої колекції містить тільки структуру/типи; не зберігати в ньому видалений авторський контент або реальні media/Const references. UI Kit містить інтерактивне demo спільних views із перемиканням Editor/CMS, сортуванням, додаванням і видаленням.

## Дії діалогу групи

Спільний openGroupDialog використовується в Const, Collections, Pages та UI Kit. Edit group має тільки Delete зліва й Save справа, однакові width/height з токена ui-dialog-action-width та control-md. Delete спочатку відкриває підтвердження; лише його Delete прибирає групу й переносить елементи до Ungrouped. Кнопки Cancel немає: клік на backdrop або Escape закриває діалог без збереження. New group використовує ту саму Save справа.

## Редагування тексту на canvas

Спільний canvas-text-edit.js реєструє статичні та CMS-bound поля. Один клік вибирає й фокусує текст без прокрутки; Enter вмикає plaintext editing. Подвійний клік також вмикає editing без scrollIntoView. Escape завершує режим і зберігає введений текст через чинну чернетку; blur/Enter також завершують, Shift+Enter додає рядок. Focus використовує preventScroll.

Canvas-origin focus передає scroll:false; обробник highlight не прокручує iframe у відповідь. Вибір через інспектор може прокручувати canvas. Повторні кліки всередині editing не переселекчують групу, тому не збивають caret. Const / змішані токени відкривають редагування Const або поля й не перетворюються на літерали. Технічні елементи залишаються виключеними. UI Kit містить інтерактивний приклад того самого helper.

## CMS manager: окремий простір даних

Уточнення користувача замінює попередній layout CMS із canvas: вкладка CMS тепер має каталог колекцій зліва, таблицю item по центру й редактор вибраного item справа. Списки залишаються видимими. Без вибраного item таблиця займає решту ширини; на вузькому екрані редактор переходить під таблицю. Editor зберігає canvas і компактні collection views.

Таблиця підтримує select all/indeterminate, checkbox окремого запису, compact search, Active/Archived, New item, bulk Archive/Restore/Delete. Bulk controls показуються тільки за вибору. Повторювані колекції зберігають спільний pointer drag та ↑/↓. Заголовок — назва, невелика type-badge і New item; зайві Back/type-блоки та Save draft прибрані з CMS Pages. Поля CMS Pages автоматично зберігаються в серверну чернетку через серіалізовану чергу без перетирання введення під час запиту.

Inline Archive переносить record до editorSettings.archivedCollectionItems зі старим індексом і власними linkSettings. Restore вставляє його назад і перенумеровує paths; Delete прибирає з чернетки, перед останнім видаленням зберігається skeleton полів. Archive не губить медіа чи Const. Зміни підтримують спільні Undo/Redo та Publish.

Posts/projects використовують staged editorSettings.entryStates: active/archived/deleted + publishedRevision. Перед Publish перевіряється актуальна ревізія. Публікація очищає pending entryStates, застосовує cmsState до архівованих файлів або видаляє source/draft файли після резервної копії в рамках project transaction. Помилка відкочує всі файли. cmsJsonLoader і page-list виключають архівовані записи з публічних сторінок. Посилання на зняті сторінки перевіряються до застосування.

UI Kit має робочий приклад catalog/table/editor із checkbox, select all, archive/restore/delete та демонстраційним редагуванням, без зміни даних проєкту.

## Узгоджений snapshot публікації

Перед підготовкою Publish спочатку відкрити busy-діалог, щоб завершити focused fields; дочекатися canvas flush handshake (редагування + acknowledgement), усіх async slug-normalizations, CMS save queue і root save queue. Тільки потім читати project-status та показувати підтвердження. Передавати expectedDraftRevision, expectedEntries і expectedMediaRevision з одного підтвердженого snapshot, не змішувати їх із пізнішими mutable S.*.

No-op save після перевірки expected revision повертає існуючу ревізію, а не створює нову. Перевірки справжніх concurrent changes лишаються на сервері; не повторювати Publish автоматично й не підміняти expectedEntries свіжими без повторного перегляду користувачем. Підготовка очікує async нормалізацію slug і скасовує залишковий timer автозбереження.

## CMS schema and article editing — 29 жовтня 2026

CMS manager shows All / Active / Archive, direct double-click collection rename and one Edit action for collection layout. The designer owns field order, groups, field types, option lists, defaults and reference target. Every item form renders those groups in the saved order. Rich text uses composable blocks and a slash menu; media/gallery is a compact thumbnail grid. The same source definitions and controls are demonstrated live in UI Kit under CMS collection layout.

Reference fields store stable target IDs (one ID or an ordered array); their labels are resolved from the current collection on each render. Publish rejects dangling references, invalid field values or malformed rich documents. A field removed from layout does not silently erase stored content. The public renderer escapes content and links, and outputs authored rich blocks. This follows Notion's database property/layout and writing patterns and Webflow's reference identity model.

### Quiet article blocks and selection formatting — 29 жовтня 2026

Rich text has no permanent toolbar and no block background on hover/focus. Only an explicit block selection gets the selection surface. Hover/focus reveals two quiet handles: add and drag/select. Text selection opens a floating toolbar with block type, bold, italic, underline, strike, inline code and links. The toolbar is attached to the document surface and clamped to the viewport so inspector overflow cannot clip it. Block selection also exposes type conversion and deletion. CMS table rows wrap titles; narrow tables place status below the title and omit the unused reorder column when reordering is unavailable.

### Rich text: Markdown input and block menu — 29 жовтня 2026

`/` in an empty paragraph opens a searchable block menu while keeping the caret in the paragraph. Continue typing to filter; ↑/↓ chooses an option, Enter applies it, Escape closes without deleting the typed slash. `+` opens the same menu immediately: it converts an empty row or inserts the chosen type after a populated row. Cancelling does not create a block. The menu lives in the document surface, clamps to the viewport and owns its internal scroll. There is no separate bottom Add block button.

Backspace removes an empty paragraph (browser BR sentinels count as empty); the last block remains an editable paragraph. Empty list/task blocks first return to Text. To-do checkboxes align with the first text line. Links use the shared `targetToggle`, persist `_self` / `_blank` in runs and honor the target in the public renderer. Rich block drag uses `startSortable`: floating card, placeholder, edge scrolling, Escape cancellation. Alt + ↑/↓ moves a focused grip.

Typing supports bullet markers `* ` / `- ` / `+ `, `[]` / `[ ]` / `[x]`, numbered markers, `# ` through `#### `, `> ` for a toggle, `" ` for a quote, triple backticks for code and `---` for a divider. Inline Markdown supports bold, italic, strike, code and safe links. Plain-text Markdown paste creates headings, lists, tasks, quotes, fenced code, dividers, images and simple pipe tables; soft paragraph breaks are preserved. Pasted `>` uses Markdown blockquote semantics. Draft storage remains the existing structured block document, so media, tables, tasks and link targets keep their metadata. This is a supported Markdown subset, not a full CommonMark implementation.

CMS record rows use rounded bordered cards with consistent inset padding. The shared UI Kit includes the populated article, tasks and an empty paragraph, and the CMS manager example uses the same record card CSS.

References: [Notion writing basics](https://www.notion.com/help/writing-and-editing-basics), [keyboard shortcuts](https://www.notion.com/en-gb/help/keyboard-shortcuts), [slash commands](https://www.notion.com/en-gb/help/guides/using-slash-commands).

### Page URL below slug

CMS page slug fields show the route directly below the input using the shared `pageURLLink` component: purple text, wrapping path and an external-arrow icon. The route updates on input and after slug normalization; empty slugs show no link. Open in a new tab to preserve the current editor. A newly created or changed draft URL becomes publicly routable after the shared Publish action. The UI Kit includes the same component in its Page URL example.

### Public website typography

Website typography is separate from admin typography. Fluid rem scaling belongs to html only; body uses the site's text-m role. BaseLayout loads the shared cms-rich.css after reset and typography for every page. Rich content uses the responsive prose size token, inherited line height, explicit list markers, readable toggle/code/caption/table styles and consistent spacing. `/style-guide/` renders the shared public block renderer; the admin UI Kit links to this live website typography example.

### CMS editing controls — 29 жовтня 2026

The rich editor grip opens a selected-block action menu. Shift-click selects the contiguous range from the anchor; Cmd/Ctrl-click toggles individual blocks; dragging the empty gutter selects intersecting rows. Clicking an already selected grip preserves the full selection. Duplicate and Delete act on that selection, including media blocks. A small activation threshold in the shared sortable helper distinguishes the action-menu click from sorting. A selected group moves together through the same floating-row/placeholder interaction. Keyboard Delete/Backspace operates on selected blocks outside text inputs; Cmd/Ctrl+A selects blocks when the editor itself is focused.

`media-editor.mjs` supplies the shared article/cover/gallery image control. The canvas shows the image and quiet hover actions; an empty block shows Add an image. Upload, Library, Link and Settings live in a native modal dialog with focus handling and Escape. Alt text and captions belong in Settings; captions appear as text below an image after saving. Upload and file drop use the existing authenticated Media draft upload/history, so unpublished assets use the library preview URL. Library selection and replacement preserve alt/caption metadata. File errors stay visible.

CMS property groups and fields use spacing instead of repeated rules. A shared itemHeader places Close at the top right of both page and inline-item forms; Close flushes page edits before returning to the current item list. Editor drilldown retains its Back navigation. The same header, quiet controls, image dialog, selection and switches appear in UI Kit.

`publishedToggle` is an accessible switch for `isPublished`, independent of Archive and pending edits. It appears on page rows and in the open page header. New pages begin unpublished. Legacy pages without this field keep their current public visibility. The shared project Publish persists the switch, and public content loading, page discovery, related-item rendering and route validation exclude unpublished pages. No module-specific Publish is introduced.

New pages persist `slugMode: auto`; title edits generate a transliterated, lowercase Latin slug up to 120 characters. Manual slug editing switches to manual mode. Generate from title restores auto mode. Automatic collisions add `-2`, `-3`, etc. Server saves reserve both published and draft slugs across the whole collection, under serialization; manual collisions are rejected. Existing entries keep their URLs until explicitly regenerated. Client validation provides early feedback; server validation remains authoritative.

References: [Notion media options](https://www.notion.com/help/images-files-and-media), [Framer CMS status and slugs](https://www.framer.com/academy/lessons/getting-started-with-the-framer-cms), [Framer CMS Markdown](https://www.framer.com/help/articles/using-markdown-in-the-cms/).

### Updated CMS forms and one Active / Archive state

This user correction supersedes the earlier collapsible property groups and separate Published switch. CMS forms use always-visible sections with a heading and one quiet divider between sections. Rich text has its own bordered field. Status is a separate form field, using the same Active / Archive switch as the item row; the catalog exposes only Active and Archive filters. There is no extra Archive button beneath the form.

Both page-backed and inline items route the switch through the existing archive/restore operation, project draft, chronological history and shared Publish. Inline archive preserves the complete item and owned link metadata in archivedCollectionItems. Page archive stages entryStates with the source revision. Existing legacy isPublished:false records appear in Archive; restoring them updates the legacy visibility flag together with cmsState inside the publication transaction. The live site changes only on shared Publish.

The shared sortable helper supports grid layout for galleries: both pointer coordinates determine the insertion slot, the floating card follows both axes, the placeholder keeps the tile dimensions, and Add an image remains after sortable images. Animation transforms are excluded from grid hit geometry. Arrow keys also reorder gallery images; Escape cancels pointer sorting. Native image dragging is disabled. The UI Kit contains the same gallery field, permanent form sections and Active / Archive controls. Image controls filter absent children before calling native DOM append/replaceChildren, so no `null` text appears below images.

### Refined authoring controls

The CMS status control shows only Active / Inactive, without a separate Status label. `publishedToggle` now uses a button with role=switch, aria-checked and an explicit measured thumb; track geometry lives in design tokens. Archive remains the collection filter/lifecycle name. Destructive confirmation footers place Cancel before Delete on the right, with Cancel as the first focusable action.

Collection headers put the name on the left and compact search, Filters, Edit and New item on the right. Active / Archive are options inside Filters; the default All items shows both states. Narrow panels reflow those controls in reading order. The table heading has no lower rule, avoiding a second line directly above the first item card.

There is no Generate from title button. Title changes generate a unique slug until the user edits the slug manually. Explicit manual mode preserves the authored URL. Existing records without a mode use automatic generation on the next title edit.

`date-control.mjs` renders date and datetime fields/defaults through a shared calendar popover, month navigation, keyboard day navigation, Today/Clear/Done and an optional local-time input. Datetime values persist as ISO UTC and display in the browser's local timezone, without the former UTC-string slicing error.

Image source selection has three tabs: Upload, Library and Link. Alt text and optional caption live below the source selector on every tab, with a common Cancel / Save image footer. Upload stages the file, then lets the author finish metadata before applying the image block. Library selection reopens the same pending metadata with the chosen file. Settings uses the same dialog rather than a separate metadata-only tab.

New field creation starts with an icon-card type grid. The next screen shows the name, a muted stable key, group, type-specific settings/default, help text and Required. Default controls are boolean switches, numeric inputs, calendars, option dropdowns or multiselect checkboxes as appropriate. Hide in form and the old key disclosure are removed. Collection layout groups use quiet headings and hoverable rows rather than nested bordered cards. Supported storage/validation contracts are documented in CMS_FIELD_ARCHITECTURE.md, which agents must read when preparing sites.

### Rich block handles, divider and Open Graph

Rich block handles follow pointer hover rather than contenteditable focus, so a caret in one block does not reveal a second set while another block is hovered. A divider is a full-width flexible horizontal rule centered inside its row; explicit width/border geometry avoids the browser's collapsed hr inside the flex container.

CMS Page identity and SEO fields are permanent required built-ins. Open Graph image is optional and uses the shared image dialog plus the 1200 × 630 crop workflow in Page settings and CMS Page forms. Too-small files produce a size-specific error; larger/nonmatching sources require explicit cropping before selection. The crop output is staged through Media and validated from bytes at Publish. UI Kit includes a divider and the same OG field/required page form definitions.


### CMS workspace continuity and populated fields

The CMS workspace restores the last collection and open item on reload, along with search, status filter and pane scroll positions. Navigation preferences use a versioned localStorage entry per admin path; they never contain content or replace server drafts. Page entries restore by ID. Inline records use their ID, with a unique title fallback for legacy records; deleted or ambiguous targets return to the list. Workspace hashes follow the selected mode.

The item list starts at 360px and shares `cms-layout.mjs` with UI Kit. Its separator supports pointer dragging, left/right arrows, Home/End, Escape cancellation and double-click reset. The usual range is 240–560px, further constrained by available width so the item editor stays usable. Small screens stack the panels. Width is a local preference.

Reference and multireference fields use compact removable chips and a searchable popover with selection marks. Arrow keys and Enter choose results; Escape closes. Multireference chips share grid sorting and arrow-key reordering. Avoid native radio controls inside stretched field labels. The Filled CMS fields example displays every supported type with populated values.


### Const insertion, optional time and floating formatting

A field's ability to accept a Const does not give it an orange focus ring or orange insert button. Use the normal focus and hover colors; actual Const chips and bound-value indicators keep their semantic orange. `constPickerList` shares a two-line name/value layout with fixed usage metadata, so long values cannot squeeze the name. Insert Const has no introductory hint.

Datetime calendars start without a time for empty/date-only values. Add time reveals the time input; disabling it saves the selected calendar day without a time. Existing timestamps preserve their time until explicitly disabled. The publish-date schema accepts both valid date-only strings and ISO timestamps.

Rich-text formatting menus recalculate their anchor from the current text range or selected block on scroll and resize, even while a menu control has focus. Hide when the anchor starts crossing a clipping pane or viewport edge. The CMS list/item gutter is half its previous width, keeping the same resizing separator.


### Stable drag appearance and equal CMS gutters

The shared sortable helper snapshots the computed appearance of the live row and descendants before moving it to the floating layer. This preserves ancestor-dependent table columns, container-query layouts, labels, controls, media and typography. It restores original inline styles after drop or Escape; no content is recreated or removed. The CMS list is included as the edge-scroll pane. UI Kit includes a long, wrapping record title for reviewing this state.

The catalog/list and list/item gutters have the same 8px spacing. The resize separator occupies the second gutter without adding a separate visible column gap. Narrow stacked layouts retain normal editor margins.


### Item duplication and workspace transitions

Open CMS items offer Duplicate in the header. The shared duplicate dialog asks only for Name, with Cancel and Duplicate actions; Enter submits. Copy field values, media and reference selections, but assign a new record ID and automatically generate a unique slug for page records. Keep copies in the shared draft/history/Publish workflow. Inline records also copy their owned link settings to the new index. The UI Kit CMS workspace demonstrates duplication without modifying project content.

On leaving CMS, explicitly hide its list resize separator as well as its catalog and records. A leftover visible separator becomes an extra grid child in the Editor and can squeeze the inspector into a narrow implicit column. CSS also excludes the CMS separator outside CMS layouts.


### Duplicate header action

CMS item headers use the shared `duplicateAction` icon button with the Lucide Copy icon, a `Duplicate item` tooltip and accessible name. Use the same control for inline records, page entries and the UI Kit workspace. The confirmation dialog retains its Name input and labelled Duplicate submit action.
