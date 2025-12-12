
# Портал ввода данных (React + TypeScript + Webpack)

Админ-интерфейс для работы с рабочими пространствами, таблицами, виджетами и формами (**main / sub / tree**).
Клиент на **React 19**, **TypeScript 5**, сборка — **Webpack 5**, UI — **MUI v7**, стили — **SCSS-модули**.

## Оглавление


1. [Технологии](#технологии)
2. [Требования](#требования)
3. [Установка и первый запуск](#установка-и-первый-запуск)
4. [Скрипты npm](#скрипты-npm)
5. [Переменные окружения](#переменные-окружения)
6. [Структура проекта](#структура-проекта)
7. [Основные модули](#основные-модули)
8. [API эндпоинты (по swagger)](#api-эндпоинты-по-swagger)
9. [Рабочие сценарии в ui](#рабочие-сценарии-в-ui)
10. [Сборка и деплой](#сборка-и-деплой)
11. [Траблшутинг](#траблшутинг)
12. [Код-стайл](#код-стайл)
13. [FAQ](#faq)

## Технологии

* React 19 / ReactDOM 19
* TypeScript 5
* Webpack 5, webpack-dev-server
* SCSS (modules), `sass-loader`
* MUI v7 (`@mui/material`, `@emotion/*`)
* React Router v7
* Zustand (точечно)
* Chart.js / ECharts (по необходимости)
* Axios (инстанс в `services/api.ts`)
* Dayjs, MUI Date Pickers

[↥ Оглавление](#оглавление)

---

## Требования

* **Node.js** ≥ 18 LTS (рекомендуется 20 LTS)
* **npm** ≥ 9

Проверка:

```bash
node -v
npm -v
```

[↥ Оглавление](#оглавление)

---

## Установка и первый запуск

```bash
# 1) Установить зависимости
npm install

# 2) (опционально) создать .env.local — см. «Переменные окружения»
# 3) Запустить dev-сервер
npm start
# открой http://localhost:8080/
```

Сборки:

```bash
npm run build:dev    # дев-сборка (без сервера)
npm run build:prod   # продакшн-сборка
```

[↥ Оглавление](#оглавление)

---

## Скрипты npm

Из `package.json`:

```json
{
  "scripts": {
    "start": "webpack serve --env mode=development ",
    "build:dev": "webpack --env mode=development",
    "build:prod": "webpack --env mode=production",
    "build:mobile": "webpack --env mode=production --env platform=mobile",
    "build:descktop": "webpack --env mode=production --env platform=desktop"
  }
}
```

* `npm start` — dev-сборка + локальный сервер.
* `npm run build:dev` — сборка дев-бандла в `dist/`.
* `npm run build:prod` — минифицированный прод.
* `npm run build:mobile` / `build:descktop` — сборки с `--env platform` (обрабатывается в конфиге webpack).

[↥ Оглавление](#оглавление)

---

## Переменные окружения

Создай **`.env.local`** в корне проекта (или используй свой способ прокидывания env):

```dotenv
# Базовый URL API
APP_API_BASE_URL=https://csc-fv.pro.lukoil.com/api

# Заголовок доступа (если требуется бэком)
APP_ACCESS_ID=your-access-id
```

Пример интеграции в `webpack.config` (фрагмент):

```ts
import webpack from 'webpack';

export default {
  // ...
  plugins: [
    new webpack.DefinePlugin({
      'process.env.APP_API_BASE_URL': JSON.stringify(process.env.APP_API_BASE_URL),
      'process.env.APP_ACCESS_ID': JSON.stringify(process.env.APP_ACCESS_ID),
    }),
  ],
};
```

`services/api.ts`:

```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.APP_API_BASE_URL,
});

api.interceptors.request.use(cfg => {
  const accessId = process.env.APP_ACCESS_ID;
  if (accessId) cfg.headers['access-id'] = accessId;
  return cfg;
});
```

[↥ Оглавление](#оглавление)

---

## Структура проекта

```
src/
  assets/
    color/
    image/                    # SVG/иконки (EditIcon.svg, DeleteIcon.svg и т.п.)
    styles/                   # Глобальные scss/миксины
  components/
    formTable/
      FormTable.tsx
      TreeFormTable.tsx
      SubFormTable.tsx
    modals/
      modalAddWorkspace/
      modalAddConnection/
      modalAddNewTable/
      modalAddWidget/
      modalAddForm/
      modalEditForm/
    setOfTables/
      SetOfTables.tsx
      SetOfTables.module.scss
    topComponent/
      TopComponent.tsx
      TopComponent.module.scss
    WidgetColumnsOfTable/
      WidgetColumnsOfTable.tsx
  pages/
    Main/
      Main.tsx
      Main.module.scss
  services/
    api.ts
  shared/
    hooks/
      useWorkSpaces.ts        # бизнес-логика WS/Tables/Widgets/Forms
    themeUI/
      themeModal/ThemeModalUI.ts
    buttonForm/ButtonForm.tsx
  types/
    typesWorkSpaces.ts
index.html
index.tsx
```

[↥ Оглавление](#оглавление)

---

## Основные модули

* **`shared/hooks/useWorkSpaces.ts`** — ядро клиентской логики и кэшей:
  загрузка/удаление **Workspaces**, **Tables**, **Widgets**; CRUD **Forms** (main/sub/tree); столбцы, references, публикация таблиц; отображение форм (`loadFormDisplay`, `loadSubDisplay`, `loadFormTree`); кэши форм `formsByWidget`, `formsById`, `formsListByWidget`.
* **Модалки**
  `ModalAddForm` — создание формы + выбор **sub-widget** по **имени** (автокомплит → id) и **tree-field** по имени (автокомплит → id).
  `ModalEditForm` — вкладки **Main/Sub/Tree**: `PATCH` + `DELETE` для sub/tree.
* **Отображение**
  `SetOfTables` — основное рабочее место: main-таблица, сабы, дерево.
  `TreeFormTable` — фильтры/справочники слева с вложенной подгрузкой.
  `TopComponent` — панель навигации и действий (WS → Tables → Widgets → Forms).

[↥ Оглавление](#оглавление)

---

## API эндпоинты (по swagger)

### Формы

```
GET    /forms                       # список форм
POST   /forms/                      # создать форму (form + sub_widgets_lst + tree_fields_lst)
PATCH  /forms/{formId}              # правка main (name, description, path, main_widget_id)
PATCH  /forms/{formId}/sub/{subId}  # правка sub (widget_order, where_conditional)
PATCH  /forms/{formId}/tree/{colId} # правка tree (column_order)
DELETE /forms/{formId}/sub/{subId}  # удалить sub из формы
DELETE /forms/{formId}/tree/{colId} # удалить поле tree
```

### Отображение формы

```
POST /display/{formId}/main               # таблица main (массив фильтров [{table_column_id, value}])
POST /display/{formId}/sub?sub_widget_order={order}   # саб-таблица для выбранной строки
POST /display/{formId}/tree               # дерево/справочники (принимает фильтры)
```

### CRUD данных (для main)

```
POST   /data/{formId}/{widgetId}   # insert
PATCH  /data/{formId}/{widgetId}   # update
DELETE /data/{formId}/{widgetId}   # delete
```

> Для insert/update/delete у таблицы должны быть настроены SQL-шаблоны: `insert_query`, `update_query`, `delete_query`. В UI есть префлайт-проверки.

[↥ Оглавление](#оглавление)

---

## Рабочие сценарии в UI

1. **Создание формы**
   Открой нужный виджет → “Создать форму” → в модалке заполни **Main** и при необходимости добавь:

    * **Sub-widgets** (выбор по имени → `sub_widget_id` уходит в API)
    * **Tree-fields** (выбор колонки по имени → `table_column_id`)
2. **Редактирование формы**
   Иконка ✎ → модалка с тремя вкладками (**Main/Sub/Tree**). Поддерживаются `PATCH` и `DELETE` для sub/tree.
3. **Фильтрация через дерево**
   Клик по значению в дереве слева — фильтр применяется к main; повторный клик разворачивает вложенные ветки.
4. **Работа с данными main**

    * Добавление: кнопка “+”, значения по `table_column_id`.
    * Редактирование: инлайн-режим в строке.
    * Удаление: с подтверждением.
      Все действия требуют соответствующих SQL-шаблонов на таблице.

[↥ Оглавление](#оглавление)

---

## Сборка и деплой

```bash
npm run build:prod
# или таргеты платформ
npm run build:mobile
npm run build:descktop
```

Деплой содержимого `dist/` любым статическим сервером (например, **nginx**).
Для SPA не забудь роутинг (fallback на `index.html`).

[↥ Оглавление](#оглавление)

---

## Траблшутинг

* **404 “Insert/Update/Delete query not found”** — на таблице не настроен соответствующий SQL-шаблон. Заполни `insert_query` / `update_query` / `delete_query`.
* **CORS / 401 / 403** — проверь `APP_API_BASE_URL` и заголовок `access-id`.
* **Пустой экран** — смотри DevTools → Console/Network, проверь `.env.local`.
* **Пусто в sub/tree** — у формы могло не быть sub/tree или неправильные id (проверь автокомплиты).

[↥ Оглавление](#оглавление)

---

## Код-стайл

* TypeScript, желательно strict-friendly.
* SCSS-модули (`*.module.scss`) для локальных стилей.
* Единая тема через MUI `ThemeProvider` (см. `ThemeModalUI`).
* Бизнес-логика — в хуках/сервисах, презентация — в компонентах.
* Именование API-функций: `load*`, `add*`, `update*`, `delete*`, `reload*`.

[↥ Оглавление](#оглавление)

---

## FAQ

**Где задаётся базовый URL API?**
В `.env.local` → `APP_API_BASE_URL`, прокидывается через `DefinePlugin`, читается в `services/api.ts`.

**Как выбрать sub-widget по имени, а не по id?**
В `ModalAddForm` используется `Autocomplete` с подгрузкой `/widgets?table_id=...`, в отправке берётся `val.id`.

**Почему дерево показывает один блок?**
Метод загрузки нормализует ответ: если пришёл объект, он оборачивается в массив `FormTreeColumn[]`. В UI рендер — `map()`.

[↥ Оглавление](#оглавление)

---




src
├── app
│   ├── App.tsx
│   ├── App.module.scss
│   ├── providers
│   │   └── ErrorBoundary.tsx
│   └── index.tsx           # можно оставить на корне src, если не хочется двигать
│
├── assets
│   ├── color/
│   ├── image/
│   ├── styles/
│   └── data.ts
│
├── pages
│   └── main
│       ├── Main.tsx
│       ├── Main.module.scss
│       └── hooks
│           ├── useMainModals.ts
│           └── useMainSelection.ts
│
├── widgets                 # крупные «виджеты/контейнеры» интерфейса
│   ├── TopComponent
│   │   ├── TopComponent.tsx
│   │   ├── TopComponent.module.scss
│   │   ├── hook
│   │   │   └── useTopMenuState.ts
│   │   ├── floating
│   │   │   └── Floating.tsx
│   │   ├── sideNav
│   │   │   ├── SideNav.tsx
│   │   │   └── SideNav.module.scss
│   │   └── menus
│   │       ├── FormsMenu.tsx
│   │       ├── TablesMenu.tsx
│   │       ├── WidgetsMenu.tsx
│   │       └── WorkspaceMenu.tsx
│   │
│   ├── SetOfTables
│   │   ├── SetOfTables.tsx
│   │   └── SetOfTables.module.scss
│   │
│   └── WidgetSelect
│       ├── WidgetSelect.tsx
│       └── WidgetSelect.module.scss
│
├── features                # доменные фичи (логика + их специфичные UI)
│   ├── forms
│   │   ├── ui
│   │   │   ├── FormTable.tsx
│   │   │   ├── AllFormStyle.module.scss
│   │   │   ├── drillDialog
│   │   │   │   └── DrillDialog.tsx
│   │   │   ├── mainTable
│   │   │   │   ├── MainTable.tsx
│   │   │   │   ├── MainTableRow.tsx
│   │   │   │   ├── MainTableAddRow.tsx
│   │   │   │   ├── MainTableCombo.tsx
│   │   │   │   └── InputCell.tsx
│   │   │   ├── subForm
│   │   │   │   ├── SubFormTable.tsx
│   │   │   │   └── SubWormTable.module.scss
│   │   │   └── treeForm
│   │   │       ├── TreeFormTable.tsx
│   │   │       └── types.ts
│   │   ├── model
│   │   │   ├── useMainCrud.ts
│   │   │   ├── useSubCrud.ts
│   │   │   ├── useSubNav.ts
│   │   │   ├── useSubWormTable.ts
│   │   │   ├── useTreeHandlers.ts
│   │   │   ├── useFiltersTree.ts
│   │   │   ├── useFormSearch.ts
│   │   │   ├── useHeaderPlan.ts
│   │   │   └── useDrillDialog.ts
│   │   └── types.ts        # твой Form/types.ts
│   │
│   ├── tables
│   │   ├── ui
│   │   │   ├── tableColumn
│   │   │   │   ├── TableColumn.tsx
│   │   │   │   ├── Table.module.scss
│   │   │   │   └── TableListView.tsx
│   │   │   ├── tableToolbar
│   │   │   │   ├── TableToolbar.tsx
│   │   │   │   └── TableToolbar.module.scss
│   │   │   └── tableWidget
│   │   │       ├── TableWidget.tsx
│   │   │       └── TableWidget.module.scss
│   │   └── types
│   │       ├── tableColumn.ts
│   │       └── tableDraft.ts
│   │
│   ├── widgetColumns
│   │   ├── ui
│   │   │   ├── WidgetColumnsOfTable.tsx
│   │   │   ├── WidgetColumnsMainTable.tsx
│   │   │   ├── WidgetGroup.module.scss
│   │   │   └── parts
│   │   │       ├── RefRow.tsx
│   │   │       └── WidgetGroups.tsx
│   │   ├── model
│   │   │   ├── hooks
│   │   │   │   ├── useRefsDnd.ts
│   │   │   │   └── useRefsSync.ts
│   │   │   └── widgetColumnTable
│   │   │       └── hooks
│   │   │           ├── useAddReference.ts
│   │   │           ├── useAliasDialog.ts
│   │   │           ├── useComboboxCreate.ts
│   │   │           ├── useComboboxEditor.ts
│   │   │           ├── useEditReference.ts
│   │   │           ├── useFormPicker.ts
│   │   │           ├── useHeaderPreviewFromWc.ts
│   │   │           └── useLocalRefs.ts
│   │   ├── lib
│   │   │   ├── ref-helpers.tsx
│   │   │   └── types.ts
│   │   └── modals        # именно модалки по WidgetColumns
│   │       ├── AddReferenceDialog.tsx
│   │       ├── AddWidgetColumnDialog.tsx
│   │       ├── AliasDialog.tsx
│   │       ├── EditReferenceDialog.tsx
│   │       ├── FormPickerDialog.tsx
│   │       └── WidgetMetaDialog.tsx
│   │
│   ├── workspaces
│   │   ├── model
│   │   │   ├── useWorkSpaces.ts
│   │   │   └── typesWorkSpaces.ts
│   │   └── modals
│   │       ├── ModalAddWorkspace.tsx
│   │       ├── ModalAddWorkspace.module.scss
│   │       └── EditWorkspaceModal.tsx
│   │
│   ├── connections
│   │   ├── model
│   │   │   ├── typesConnection.ts
│   │   │   └── typesCreateConnections.ts
│   │   └── ui
│   │       ├── ModalAddConnection.tsx
│   │       └── ModalEditConnection.tsx
│   │
│   ├── formsManagement
│   │   └── ui
│   │       ├── ModalAddForm.tsx
│   │       └── ModalEditForm.tsx
│   │
│   ├── tablesMeta
│   │   └── ui
│   │       └── ModalEditTableMeta.tsx
│   │
│   ├── combobox
│   │   └── ui
│   │       ├── ComboboxAddDialog.tsx
│   │       └── ComboboxItemDialog.tsx
│   │
│   └── modalHost
│       └── ModalHost.tsx
│
├── shared                 # реально переиспользуемые штуки
│   ├── ui
│   │   ├── common
│   │   │   ├── HighlightedText.tsx
│   │   │   ├── SearchBox.tsx
│   │   │   └── SearchBox.module.scss
│   │   ├── ButtonForm.tsx
│   │   ├── Breadcrumb.tsx
│   │   ├── Breadcrumb.module.scss
│   │   ├── CenteredLoader.tsx
│   │   └── CenteredLoader.module.scss
│   │
│   ├── hooks
│   │   ├── useDebounced.ts
│   │   ├── useFuzzySearch.ts
│   │   └── useLoadConnections.ts
│   │
│   ├── api
│   │   └── api.ts          # axios-инстанс / общий клиент
│   │
│   ├── theme
│   │   └── ThemeModalUI.ts
│   │
│   ├── utils
│   │   ├── cellFormat.ts
│   │   ├── EllipsizeSmart.tsx
│   │   └── normalize.ts
│   │
│   └── types              # здесь можно оставить только общие типы, если появятся
│
├── assets (уже выше, просто напоминаю)
│
├── global.scss            # можно оставить на корне
├── global.d.ts
└── (index.tsx если не переносишь в app/)
