#!/usr/bin/env bash
# Подготовка проекта к чистому переносу/публикации на GitHub.
# Удаляет из git-индекса файлы, которые попали в репозиторий по ошибке,
# но уже перечислены в .gitignore. Сами файлы на диске не трогает.
#
# Запуск (один раз):
#   bash scripts/prepare-github.sh
#
# После выполнения проверьте `git status` и сделайте коммит:
#   git add -A
#   git commit -m "chore: remove tracked build/test artifacts from repo"
#   git push origin main

set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Снимаем с трекинга временные/служебные файлы (на диске остаются)"

# Куки от ручного тестирования через curl
git rm --cached -f cookies.txt 2>/dev/null || true

# Production-сборка (создаётся командой npm run build)
git rm --cached -rf dist 2>/dev/null || true

# Скриншоты и вложения из чата с Replit-агентом — не нужны для работы приложения.
# ⚠️ Если на эти файлы есть @assets/... импорты в коде — удалите этот блок
#    или удалите только лишнее вручную.
git rm --cached -rf attached_assets 2>/dev/null || true

# Локальные планы агента
git rm --cached -rf .local 2>/dev/null || true

# Случайно закоммиченный .env (если есть)
git rm --cached -f .env 2>/dev/null || true

echo
echo "✓ Готово. Проверьте изменения:"
echo "    git status"
echo
echo "Если всё ок — коммитим и пушим:"
echo "    git add -A"
echo "    git commit -m 'chore: clean repo for github (untrack build/test artifacts)'"
echo "    git push origin main"
