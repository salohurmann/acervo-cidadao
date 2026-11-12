#!/bin/sh
# Teste de fumaça do modo de produção: banco PostgreSQL externo (como o
# Cloud SQL, com usuário sem privilégio de superusuário) e login só com conta
# Google do domínio. O Google é substituído por ci/fake-google-token.py.
set -eu

IMAGE="${1:-acervo-cidadao:ci}"
APP=acervo-smoke-google
DB=acervo-smoke-db
BASE=http://localhost:8080/acervo/
DB_PASSWORD='Senha-de-teste_123'
BOOK='{"245":[{"a":["Livro de teste"],"ind1":"0","ind2":"0"}]}'

fail() {
	echo "FALHOU: $1"
	docker logs --tail 150 "$APP" 2>&1 || true
	exit 1
}

cleanup() {
	docker rm -f "$APP" "$DB" > /dev/null 2>&1 || true
	[ -n "${FAKE_PID:-}" ] && kill "$FAKE_PID" > /dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

python3 "$(dirname "$0")/fake-google-token.py" 9099 &
FAKE_PID=$!

# Banco externo. A porta 8080 é publicada aqui porque a aplicação vai usar a
# mesma rede deste contêiner, para enxergar o banco em 127.0.0.1:5432.
docker run -d --name "$DB" -p 8080:8080 -e POSTGRES_PASSWORD=postgres postgres:16 > /dev/null
i=0
until docker exec "$DB" pg_isready -U postgres > /dev/null 2>&1; do
	i=$((i + 1)); [ "$i" -gt 30 ] && fail "o PostgreSQL de teste não subiu"; sleep 2
done
sleep 2
docker exec "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q \
	-c "CREATE ROLE biblivre LOGIN CREATEDB CREATEROLE PASSWORD '$DB_PASSWORD'" \
	-c "CREATE DATABASE biblivre4 OWNER biblivre ENCODING 'UTF8'" || fail "não foi possível preparar o banco de teste"

GATEWAY="$(docker network inspect bridge -f '{{(index .IPAM.Config 0).Gateway}}')"

docker run -d --name "$APP" --network "container:$DB" \
	-e ACERVO_DB=external \
	-e BIBLIVRE_DB_PASSWORD="$DB_PASSWORD" \
	-e ACERVO_PUBLIC_URL="$BASE" \
	-e ACERVO_GOOGLE_CLIENT_ID=cliente-de-teste \
	-e ACERVO_GOOGLE_CLIENT_SECRET=segredo-de-teste \
	-e ACERVO_GOOGLE_TOKEN_URL="http://$GATEWAY:9099/token" \
	"$IMAGE" > /dev/null

echo "Aguardando a página inicial..."
i=0
until curl -fsS -H "Accept-Language: pt-BR" "$BASE" -o /tmp/g-home.html 2> /dev/null; do
	i=$((i + 1)); [ "$i" -gt 90 ] && fail "a página inicial não respondeu"; sleep 5
done
echo "ok  sistema no ar com banco externo e usuário sem superusuário"

if ! grep -q "Entrar com conta @seju.pr.gov.br" /tmp/g-home.html; then
	echo "--- trecho do menu na página inicial:"
	tr '\n' ' ' < /tmp/g-home.html | grep -o '<div id="menu">.\{0,900\}' || true
	echo "--- traduções do login com Google no banco:"
	docker exec "$DB" psql -U postgres -d biblivre4 -At -c "select language, key, text from global.translations where key like 'login.google%'" || true
	docker exec "$DB" psql -U postgres -d biblivre4 -At -c "select * from global.versions" || true
	fail "a página inicial não mostra o botão de login com Google"
fi
grep -q 'name="password"' /tmp/g-home.html && fail "a página inicial ainda mostra o campo de senha"
echo "ok  página inicial só com o botão de login com Google"

save_book() {
	curl -fsS -H "Accept-Language: pt-BR" -c "$1" -b "$1" \
		--data-urlencode "controller=json" --data-urlencode "module=cataloging.bibliographic" --data-urlencode "action=save" \
		--data-urlencode "id=0" --data-urlencode "from=form" --data-urlencode "material_type=book" --data-urlencode "database=main" \
		--data-urlencode "data=$BOOK" "$BASE" || true
}

can_save() {
	save_book "$1" | grep -Eq '"success": *true'
}

# Entra pelo fluxo do Google usando a conta simulada $2, com o cookie em $1.
google_login() {
	LOCATION="$(curl -sS -H "Accept-Language: pt-BR" -c "$1" -b "$1" -o /dev/null -w '%{redirect_url}' "$BASE?controller=jsp&module=login&action=google_start")"
	STATE="$(echo "$LOCATION" | sed -n 's/.*[?&]state=\([^&]*\).*/\1/p')"
	[ -n "$STATE" ] || fail "o início do login não devolveu state: $LOCATION"
	curl -sS -H "Accept-Language: pt-BR" -c "$1" -b "$1" -o /dev/null "${BASE}sso/google-callback?state=$STATE&code=$2"
}

# Usuário e senha não entram mais, nem com a senha padrão do Biblivre.
curl -fsS -H "Accept-Language: pt-BR" -c /tmp/g-pw -b /tmp/g-pw -o /dev/null \
	--data-urlencode "controller=jsp" --data-urlencode "module=login" --data-urlencode "action=login" \
	--data-urlencode "username=salomaohurmann@seju.pr.gov.br" --data-urlencode "password=abracadabra" "$BASE"
can_save /tmp/g-pw && fail "o login por senha ainda funciona com o Google ativo"
echo "ok  login por usuário e senha desativado"

LOCATION="$(curl -sS -H "Accept-Language: pt-BR" -c /tmp/g-start -b /tmp/g-start -o /dev/null -w '%{redirect_url}' "$BASE?controller=jsp&module=login&action=google_start")"
case "$LOCATION" in
	https://accounts.google.com/o/oauth2/v2/auth\?*) ;;
	*) fail "o início do login não redireciona para o Google: $LOCATION" ;;
esac
echo "$LOCATION" | grep -q "hd=seju.pr.gov.br" || fail "o pedido ao Google não restringe o domínio"
echo "$LOCATION" | grep -q "redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Facervo%2Fsso%2Fgoogle-callback" || fail "redirect_uri inesperado: $LOCATION"
echo "ok  redirecionamento para o Google com domínio e retorno corretos"

curl -sS -H "Accept-Language: pt-BR" -c /tmp/g-forged -b /tmp/g-forged -o /dev/null "${BASE}sso/google-callback?state=inventado&code=admin"
can_save /tmp/g-forged && fail "retorno com state inventado abriu sessão"
echo "ok  retorno sem state válido recusado"

google_login /tmp/g-gmail gmail
can_save /tmp/g-gmail && fail "conta @gmail.com conseguiu entrar"
curl -fsS -H "Accept-Language: pt-BR" -c /tmp/g-gmail -b /tmp/g-gmail "$BASE" | grep -q "Esta conta não é do domínio institucional" || fail "conta @gmail.com não recebeu o aviso de domínio"
echo "ok  conta @gmail.com recusada com aviso"

google_login /tmp/g-other outro-dominio
can_save /tmp/g-other && fail "conta de outro domínio conseguiu entrar"
echo "ok  conta de outro domínio do Google Workspace recusada"

google_login /tmp/g-admin admin
can_save /tmp/g-admin || fail "o administrador entrou pelo Google mas não conseguiu cadastrar um livro: $(save_book /tmp/g-admin)"
curl -fsS -H "Accept-Language: pt-BR" -c /tmp/g-admin -b /tmp/g-admin -o /tmp/g-cat.html "$BASE?action=cataloging_bibliographic" || fail "tela de catalogação com erro"
grep -q 'id="quick_add"' /tmp/g-cat.html || fail "o administrador não vê o cadastro rápido"
echo "ok  administrador entra pelo Google e cadastra livro"

google_login /tmp/g-reader leitor
can_save /tmp/g-reader && fail "um leitor recém-criado conseguiu cadastrar livro"
curl -fsS -H "Accept-Language: pt-BR" -c /tmp/g-reader -b /tmp/g-reader "$BASE" | grep -q "Entrar com conta @seju.pr.gov.br" && fail "o leitor não ficou logado depois do retorno do Google"
ROW="$(docker exec "$DB" psql -U postgres -d biblivre4 -At -c "select l.employee, u.name, u.status from single.logins l join single.users u on u.login_id = l.id where l.login = 'novo.leitor@seju.pr.gov.br'")"
[ "$ROW" = "f|Novo Leitor de Teste|active" ] || fail "cadastro automático do leitor inesperado: [$ROW]"
echo "ok  primeiro acesso cria leitor sem permissão de catalogação"

google_login /tmp/g-reader2 leitor
COUNT="$(docker exec "$DB" psql -U postgres -d biblivre4 -At -c "select count(*) from single.logins where login = 'novo.leitor@seju.pr.gov.br'")"
[ "$COUNT" = "1" ] || fail "segundo acesso do leitor duplicou o cadastro ($COUNT)"
echo "ok  segundo acesso reutiliza o cadastro"

echo "Teste de fumaça do login com Google concluído."
