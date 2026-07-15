#!/usr/bin/env bash
# Starts the Jekyll dev server using the self-contained Ruby environment at
# ~/env/portfolio-venv (built with ruby-build; installs gems into itself,
# no sudo or system Ruby required).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

export PATH="$HOME/env/portfolio-venv/bin:$PATH"

bundle install
exec bundle exec jekyll serve --livereload
