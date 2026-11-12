#!/bin/sh
# Regera os arquivos estáticos da demonstração (docs/), publicada no GitHub
# Pages: CSS compilado do tema, imagens e scripts copiados do sistema.
# Uso: sh ci/build-demo.sh [comando-sass]   (padrão: npx --yes sass@1.72.0)
set -eu
cd "$(dirname "$0")/.."
SASS="${1:-npx --yes sass@1.72.0}"

rm -rf docs/static
mkdir -p docs/static/styles docs/static/scripts docs/static/images
$SASS --no-source-map --quiet --style=compressed WebContent/static/styles/scss:docs/static/styles
for css in about acquisition administration administration.customization administration.setup administration.z3950 cataloging.import circulation multi_schema print; do
	rm -f "docs/static/styles/biblivre.$css.css"
done
find WebContent/static/images -maxdepth 1 -type f -exec cp {} docs/static/images/ \;
cp WebContent/static/scripts/jquery.js WebContent/static/scripts/biblivre.cataloging.quick_add.js docs/static/scripts/
touch docs/.nojekyll
echo "docs/ atualizado"
