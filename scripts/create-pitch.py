"""Create an explicitly labelled draft video from real UI screenshots and macOS TTS.

Requires Python + Pillow, ffmpeg/ffprobe, and macOS `say` with the Milena voice.
Run from the repository root. Output is local and ignored by Git.
This is a narrated screenshot walkthrough, not a recording of live GigaChat calls.
"""
from pathlib import Path
import json
import subprocess
import textwrap
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "pitch"
OUT.mkdir(parents=True, exist_ok=True)
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

SCENES = [
    ("01 / ПРОДУКТ", "Ваши данные.\nТеперь со смыслом.", "dashboard.png", ["Без регистрации", "Таблица → история → решение", "Демо явно отделено от AI"], "Это Ленс, микро-сервис, который превращает таблицы и заметки в понятную историю. На экране настоящий интерфейс приложения. Встроенный пример показывает продажи за сентябрь: главный вывод, основные показатели и три графика. Пользователь сразу видит, что органический поиск приносит чуть больше половины выручки. Регистрации нет. В этой версии по решению заказчика ключ Гигачат пока не подключён. Поэтому демонстрация честно помечена как деморежим: файлы и вычисления настоящие, но свободная генерация модели здесь не показывается. Этот черновой видеопитч собран из реальных экранов и озвучен синтетическим голосом."),
    ("02 / ВВОД ДАННЫХ", "Отчёт загружается.\nИстория начинается.", "upload.png", ["CSV / XLSX / TXT", "Или обычный текст", "Понятные состояния ошибок"], "Сервис принимает си эс ви, эксель и текст. Файл можно перетащить в область загрузки или выбрать на компьютере. Для текстовых заметок есть отдельное поле и готовый пример. При обработке показываются этапы и скелетоны. Если файл повреждён, пуст или слишком большой, пользователь получает понятное объяснение и может повторить попытку. На сервере проверяются размер, структура и содержимое. В экселе читается первый непустой лист, а формулы не исполняются: используются сохранённые результаты. Для тестового задания этого достаточно, чтобы закрыть полный сценарий без тяжёлого бэкенда."),
    ("03 / ПРОВЕРЯЕМЫЕ ЧИСЛА", "Красивый график.\nПроверяемый источник.", "source.png", ["Расчёты выполняет код", "GigaChat выбирает визуализацию", "Исходная таблица доступна"], "Числа рассчитываются программно. Пустые ячейки не превращаются в нули. Процентные показатели усредняются, а идентификаторы не суммируются. Временной ряд сортируется по датам. Кольцевая диаграмма допустима только для неотрицательных долей. Подключённая модель выбирает тип графика из подготовленных вариантов и объясняет выбор, но не рисует собственные значения. Можно открыть таблицу любого графика, а также все исходные строки с поиском. На этом экране отфильтрованы социальные сети. Таким образом, пользователь может пройти от красивого вывода обратно к данным, которые его подтверждают."),
    ("04 / ЧАТ С ДАННЫМИ", "Ответ — только\nс подтверждением.", "chat.png", ["2 307 заказов — из отчёта", "Зарплата директора — неизвестна", "Никаких придуманных чисел"], "У каждой цифры есть ответ, но не на любой вопрос. Здесь запрос о числе заказов вернул две тысячи триста семь. Вопрос о зарплате директора получил честный отказ: в этом отчёте нет такой информации. В режиме Гигачат сервер передаёт каталог рассчитанных фактов и найденные релевантные строки. Модель выбирает идентификаторы подтверждений. Сам текст ответа собирает сервер из этих фактов дословно. Это осознанный компромисс: меньше свободы формулировки, зато невозможно добавить произвольное число в ответ чата. Источники можно раскрыть и проверить. Демочат распознаёт только ограниченные шаблоны вопросов."),
    ("05 / ОРКЕСТРАЦИЯ ИИ", "Модель объясняет.\nКод проверяет.", None, ["Пользователь: «интеграция с гигачат»", "Hero: только facts + evidence", "Чат: answerable + evidenceIds", "JSON Schema → Zod → проверка"], "Код проекта создан с помощью Кодекс. Продуктовый контракт задавало исходное техническое задание, а пользователь направлял решения. Реальная коррекция звучала: интеграция с Гигачат. После неё первоначальный провайдер был заменён. Ещё одно реальное решение: пока проверить без ключа. Рабочий промпт для главного виджета требует два-три предложения исключительно по фактам и идентификаторы источников. Промпт чата требует подтверждений, которые отвечают на весь вопрос, а не просто похожи по теме. Дополнительно используются структурированный ответ, схема Зод и проверка чисел. Сами промпты и честный журнал работы находятся в репозитории."),
    ("06 / ОШИБКИ И ИСПРАВЛЕНИЯ", "Сгенерировать код —\nтолько половина работы.", None, ["Origin: localhost ≠ 0.0.0.0", "Сентябрьский итог ≠ октябрьский", "LENS-104 ≠ LENS-105", "Каждая ошибка → регрессионный тест"], "При проверке нашлись реальные ошибки. Сначала чат отклонял свой же запрос: браузер использовал локалхост, а Некст видел внутренний адрес ноль ноль ноль ноль. Проверку исправили и закрепили тестом. Затем выяснилось, что слишком широкий шаблон вопроса мог вернуть сентябрьский итог на вопрос про октябрь. Шаблон сузили. Тест поиска поймал ещё одну ошибку: сокращение окончания слова применялось к идентификаторам и смешивало задачи сто четыре и сто пять. Для идентификаторов оставили точное сравнение. В интерфейсе исправили обрезанные подписи оси и заменили малоинформативный график. Такие ошибки показывают ценность независимой проверки результата генерации."),
    ("07 / АРХИТЕКТУРА И DELIVERY", "Полный сценарий.\nПрозрачные ограничения.", "dashboard.png", ["Next.js · TypeScript · GigaChat", "26 тестов + production-сборка", "README, промпты и примеры", "Следующий шаг — live-проверка"], "Парсинг, аналитика, поиск строк, адаптер Гигачат и компоненты интерфейса разделены. Используются Некст, Тайпскрипт, Речартс и Моушн. Проходят двадцать шесть тестов, проверка типов, линтер и продакшен-сборка. Дополнительно проверены настоящие HTTP-запросы, загрузка экселя, ответы чата и мобильный экран. В репозитории есть инструкция запуска, тестовые файлы, промпты, ограничения и сценарий для финальной записи. Следующий обязательный шаг перед сдачей полноценного AI-сервиса — подключить ключ и проверить живую модель. Тесты с подменённым транспортом этого не доказывают. Ленс уже закрывает полный пользовательский путь и оставляет все основания для проверки видимыми."),
]

def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)

def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)

def draw_wrapped(draw, text, x, y, width, f, color, gap=12):
    for paragraph in text.split("\n"):
        line = ""
        for word in paragraph.split():
            if draw.textlength(line + " " + word, font=f) > width and line:
                draw.text((x, y), line, font=f, fill=color)
                y += f.size + gap
                line = word
            else:
                line = (line + " " + word).strip()
        draw.text((x, y), line, font=f, fill=color)
        y += f.size + gap
    return y

durations = []
for i, (kicker, title, screenshot, bullets, narration) in enumerate(SCENES):
    text_file = OUT / f"voice-{i}.txt"
    text_file.write_text(narration)
    audio_file = OUT / f"voice-{i}.aiff"
    run(["/usr/bin/say", "-v", "Milena", "-r", "163", "-f", str(text_file), "-o", str(audio_file)])
    duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio_file)])) + 1
    durations.append(duration)

    frame = Image.new("RGB", (1920, 1080), "#1e3029")
    draw = ImageDraw.Draw(frame)
    draw.text((72, 52), "lens.", font=font(58, True), fill="#dce9c7")
    draw.text((75, 177), kicker, font=font(21), fill="#98b090")
    y = draw_wrapped(draw, title, 72, 246, 760, font(51, True), "#f2f5e8", 17)
    y += 45
    for bullet in bullets:
        draw.ellipse((76, y + 12, 83, y + 19), fill="#bfdda1")
        y = draw_wrapped(draw, bullet, 105, y, 675, font(27), "#bdcdb7", 14) + 22
    if screenshot:
        shot = Image.open(ROOT / "docs" / "images" / screenshot).convert("RGB")
        shot = ImageOps.contain(shot, (995, 945), Image.Resampling.LANCZOS)
        x = 890 + (995 - shot.width) // 2
        y2 = 45 + (945 - shot.height) // 2
        frame.paste(shot, (x, y2))
    else:
        draw.rounded_rectangle((910, 160, 1830, 895), radius=28, fill="#283f33", outline="#4c6549", width=2)
        if i == 4:
            code = 'NARRATIVE_PROMPT\n\n«Используй ИСКЛЮЧИТЕЛЬНО facts.\nУкажи evidence. Не добавляй\nчисел или причин, которых нет\nв фактах».\n\nCHAT_PROMPT\n\n«Верни answerable=true и evidenceIds\nТОЛЬКО если факты напрямую\nотвечают на ВЕСЬ вопрос». '
        else:
            code = 'ПОДТВЕРЖДЕНО ПРОВЕРКАМИ\n\n✓ CSV / XLSX / текст\n✓ Числа, даты, пропуски\n✓ OAuth / 401 / 429 / таймаут\n✓ Неизвестные факты → отказ\n✓ Точный поиск по ID\n✓ Реальный браузер и HTTP\n\nLive GigaChat: ещё не проверен.'
        draw_wrapped(draw, code, 955, 205, 830, font(29), "#d4e2c4", 14)
    draw.line((72, 1000, 1848, 1000), fill="#415443", width=1)
    draw.text((73, 1022), "ДЕМО БЕЗ API-КЛЮЧА  ·  РЕАЛЬНЫЕ ЭКРАНЫ  ·  СИНТЕТИЧЕСКАЯ ОЗВУЧКА", font=font(17), fill="#9aaf90")
    draw.text((1720, 1020), f"0{i + 1} / 07", font=font(21), fill="#c5d8b5")
    image_file = OUT / f"frame-{i}.png"
    frame.save(image_file)
    run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-framerate", "5", "-i", str(image_file), "-i", str(audio_file), "-vf", "scale=1280:720,format=yuv420p", "-af", "apad", "-t", str(duration), "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage", "-crf", "24", "-r", "25", "-c:a", "aac", "-b:a", "128k", str(OUT / f"scene-{i}.mp4")])
    print(f"Rendered scene {i + 1}: {duration:.1f}s", flush=True)

concat = OUT / "clips.txt"
concat.write_text("\n".join(f"file 'scene-{i}.mp4'" for i in range(len(SCENES))))
output = ROOT / "artifacts" / "lens-pitch.mp4"
run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", "-movflags", "+faststart", str(output)])
(OUT / "metadata.json").write_text(json.dumps({ "duration_seconds": sum(durations), "scenes": len(SCENES), "voice": "macOS Milena (synthetic)", "source": "real app screenshots, demo mode", "output": str(output) }, ensure_ascii=False, indent=2))
print(f"Created {output.name}: {sum(durations):.1f}s", flush=True)
