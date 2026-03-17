Original prompt: Сделай для моего HTML5/JavaScript-проекта простой локальный 2D scene builder/editor, который работает прямо в браузере и помогает собирать сцены визуально без ручного редактирования координат.

- Создан модульный редактор: editor.html/editor.css + js/editor.js + js/ui.js.
- Данные сцены вынесены в js/scene-state.js.
- Canvas-рендер и хиттест вынесены в js/renderer.js.
- Режим runtime добавлен: runtime.html/runtime.css + js/runtime.js.
- Конфиг ассетов и defaults: js/resources.js.
- Добавлен пример сцены: scene-example.json.
- Добавлена стартовая страница: index.html.

TODO / next:
- Marquee box-select (рамка выделения) для более удобного multi-select.
- Гизмо resize по осям (не только uniform scale handle).
- Привязка к направляющим (guides) и smart snapping.
- Группы/контейнеры и prefab-идентификаторы в JSON.
- Упрощено добавление ассетов: кнопка `Add Files` в editor.html + file picker.
- При выборе файлов ассеты добавляются в левую панель автоматически.
- Для JSON используется `src` вида `./assets/<имя_файла>`; размеры читаются из файла.
- Пользовательские ассеты сохраняются в localStorage (`scene_builder:custom_assets`).
