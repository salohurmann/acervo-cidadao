#!/bin/sh
# Teste de fumaça da imagem: sobe o contêiner, espera a página inicial,
# entra como administrador, cadastra um livro pelo mesmo caminho do
# "Cadastro rápido" e entra de novo (segunda entrada já com a senha em PBKDF2).
set -eu

IMAGE="${1:-acervo-cidadao:ci}"
NAME=acervo-smoke
BASE=http://localhost:8080/acervo/
ADMIN_LOGIN='salomaohurmann@seju.pr.gov.br'
ADMIN_PASSWORD='abracadabra'

fail() {
	echo "FALHOU: $1"
	docker logs --tail 200 "$NAME" || true
	exit 1
}

docker rm -f "$NAME" > /dev/null 2>&1 || true
docker run -d --name "$NAME" -p 8080:8080 "$IMAGE" > /dev/null

echo "Aguardando a página inicial..."
i=0
until curl -fsS "$BASE" -o /tmp/home.html 2> /dev/null; do
	i=$((i + 1))
	[ "$i" -gt 90 ] && fail "a página inicial não respondeu em 7,5 minutos"
	sleep 5
done
grep -q "Secretaria da Justi" /tmp/home.html || fail "a página inicial não tem o rodapé da SEJU"
echo "ok  página inicial"

login() {
	curl -fsS -c "$1" -b "$1" -o /tmp/login.html \
		--data-urlencode "controller=jsp" --data-urlencode "module=login" --data-urlencode "action=login" \
		--data-urlencode "username=$ADMIN_LOGIN" --data-urlencode "password=$2" "$BASE"
}

save_book() {
	curl -fsS -c "$1" -b "$1" \
		--data-urlencode "controller=json" --data-urlencode "module=cataloging.bibliographic" --data-urlencode "action=save" \
		--data-urlencode "id=0" --data-urlencode "from=form" --data-urlencode "material_type=book" --data-urlencode "database=main" \
		--data-urlencode "data={\"100\":[{\"a\":[\"Assis, Machado de\"],\"ind1\":\"1\"}],\"245\":[{\"a\":[\"$2\"],\"ind1\":\"1\",\"ind2\":\"0\"}],\"260\":[{\"b\":[\"Garnier\"],\"c\":[\"1899\"]}]}" \
		"$BASE"
}

login /tmp/jar1 "$ADMIN_PASSWORD"
RESPONSE="$(save_book /tmp/jar1 'Dom Casmurro')"
echo "$RESPONSE" | grep -Eq '"success": *true' || fail "cadastro do livro: $RESPONSE"
RECORD_ID="$(echo "$RESPONSE" | grep -Eo '"id": *[0-9]+' | head -n 1 | tr -cd '0-9')"
[ -n "$RECORD_ID" ] || fail "cadastro do livro não devolveu o id: $RESPONSE"
echo "ok  login e cadastro do livro (registro $RECORD_ID)"

# A tela de catalogação precisa renderizar com o painel do cadastro rápido.
curl -fsS -c /tmp/jar1 -b /tmp/jar1 -o /tmp/cataloging.html "$BASE?action=cataloging_bibliographic" \
	|| fail "a tela de catalogação respondeu com erro"
grep -q 'id="quick_add"' /tmp/cataloging.html || fail "a tela de catalogação não tem o cadastro rápido"
grep -q 'biblivre.cataloging.isbn_lookup.js' /tmp/cataloging.html || fail "a tela de catalogação não carrega a consulta por ISBN"
echo "ok  tela de catalogação com cadastro rápido"

# A página inicial de quem está logado precisa renderizar (atalhos do funcionário).
curl -fsS -c /tmp/jar1 -b /tmp/jar1 -o /tmp/home-logged.html "$BASE" || fail "a página inicial logada respondeu com erro"
echo "ok  página inicial logada"

RESPONSE="$(curl -fsS -c /tmp/jar1 -b /tmp/jar1 \
	--data-urlencode "controller=json" --data-urlencode "module=cataloging.holding" --data-urlencode "action=create_automatic_holding" \
	--data-urlencode "record_id=$RECORD_ID" --data-urlencode "database=main" --data-urlencode "holding_count=2" "$BASE")"
echo "$RESPONSE" | grep -Eq '"success": *true' || fail "criação dos exemplares: $RESPONSE"
echo "ok  criação de 2 exemplares"

# Senha errada não pode autenticar.
login /tmp/jar-bad 'senha-errada' || true
RESPONSE="$(save_book /tmp/jar-bad 'Nao deve gravar' || true)"
echo "$RESPONSE" | grep -Eq '"success": *true' && fail "senha errada conseguiu gravar um registro"
echo "ok  senha errada recusada"

# Segundo login: a senha do administrador já foi regravada em PBKDF2.
login /tmp/jar2 "$ADMIN_PASSWORD"
RESPONSE="$(save_book /tmp/jar2 'Memorias Postumas de Bras Cubas')"
echo "$RESPONSE" | grep -Eq '"success": *true' || fail "segundo login (senha migrada para PBKDF2): $RESPONSE"
echo "ok  segundo login com a senha migrada"

docker rm -f "$NAME" > /dev/null
echo "Teste de fumaça concluído."
