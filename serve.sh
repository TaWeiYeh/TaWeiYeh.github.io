#!/usr/bin/env bash
# Installs dependencies (working around a broken local Xcode CLT C++ header
# path that breaks compiling the eventmachine native extension) and starts
# the Jekyll dev server.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

SDK="$(xcrun --show-sdk-path)"
export CPLUS_INCLUDE_PATH="$SDK/usr/include/c++/v1"

bundle install --path vendor/bundle
exec bundle exec jekyll serve --livereload
