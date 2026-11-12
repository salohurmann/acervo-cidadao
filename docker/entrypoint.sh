#!/bin/sh
# Prepara o banco de dados e sobe o Tomcat.
#
# ACERVO_DB              local (padrão) ou external
# BIBLIVRE_DB_PASSWORD   senha do usuário "biblivre" do PostgreSQL
#                        (obrigatória no modo external)
# CLOUD_SQL_INSTANCE     modo external no Cloud Run: nome de conexão da
#                        instância (projeto:região:instância)
# PORT                   porta HTTP (padrão 8080)
# ACERVO_GOOGLE_*, ACERVO_PUBLIC_URL, ACERVO_ADMIN_EMAIL: login com Google,
#                        lidos pela aplicação (biblivre.login.GoogleLogin)
set -e

DB_MODE="${ACERVO_DB:-local}"
PORT="${PORT:-8080}"
CONTEXT_XML=/usr/local/tomcat/webapps/acervo/META-INF/context.xml

as_postgres() {
	su postgres -s /bin/sh -c "$1"
}

load_schema() {
	echo "[acervo] Carregando a estrutura inicial do Acervo Cidadão"
	"$@" > /dev/null
	echo "[acervo] Banco de dados pronto"
}

# O Biblivre abre um assistente de instalação, sem login, enquanto a
# biblioteca está marcada como nova; nele é possível até restaurar um backup.
# Num servidor exposto na internet isso não pode ficar aberto, então a
# instalação limpa (que é só desligar essa marca) é feita aqui.
SKIP_SETUP_SQL="UPDATE single.configurations SET value = 'false' WHERE key = 'setup.new_library'"

if [ "$DB_MODE" = "external" ]; then
	if [ -z "$BIBLIVRE_DB_PASSWORD" ]; then
		echo "[acervo] ERRO: defina BIBLIVRE_DB_PASSWORD no modo external." >&2
		exit 1
	fi

	# A senha vai para um arquivo XML e para a variável PGPASSWORD; ficar em
	# letras, números e . _ ~ - evita qualquer problema de escape.
	case "$BIBLIVRE_DB_PASSWORD" in
		*[!A-Za-z0-9._~-]*)
			echo "[acervo] ERRO: BIBLIVRE_DB_PASSWORD deve ter só letras, números e os sinais . _ ~ -" >&2
			exit 1
			;;
	esac

	if [ -n "$CLOUD_SQL_INSTANCE" ]; then
		echo "[acervo] Ligando 127.0.0.1:5432 ao Cloud SQL ($CLOUD_SQL_INSTANCE)"
		socat TCP-LISTEN:5432,bind=127.0.0.1,fork,reuseaddr "UNIX-CONNECT:/cloudsql/$CLOUD_SQL_INSTANCE/.s.PGSQL.5432" &
	fi

	# PGHOST também é herdado pelo Tomcat: é assim que o pg_dump e o psql
	# chamados pelo Biblivre (backup, restauração) chegam ao banco externo.
	export PGHOST=127.0.0.1 PGPORT=5432
	export PGUSER=biblivre PGDATABASE=biblivre4 PGPASSWORD="$BIBLIVRE_DB_PASSWORD"

	echo "[acervo] Aguardando o banco de dados externo"
	tries=0
	until psql -Atc "select 1" > /dev/null 2>&1; do
		tries=$((tries + 1))
		if [ "$tries" -gt 60 ]; then
			echo "[acervo] ERRO: não foi possível conectar ao banco biblivre4 como usuário biblivre em 127.0.0.1:5432." >&2
			psql -Atc "select 1" || true
			exit 1
		fi
		sleep 2
	done

	if [ "$(psql -Atc "select count(*) from pg_namespace where nspname = 'global'")" = "0" ]; then
		load_schema psql -q -f /opt/acervo/sql/biblivre4.sql
		psql -q -c "$SKIP_SETUP_SQL"
	fi

	unset PGUSER PGDATABASE PGPASSWORD

	sed -i "s/dataSource.password=\"[^\"]*\"/dataSource.password=\"$BIBLIVRE_DB_PASSWORD\"/" "$CONTEXT_XML"
else
	PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -n 1)"
	PGDATA="${PGDATA:-/data/pgdata}"

	mkdir -p "$PGDATA" /var/run/postgresql
	chown -R postgres:postgres "$(dirname "$PGDATA")" /var/run/postgresql
	chmod 700 "$PGDATA"

	FIRST_RUN=0
	if [ ! -s "$PGDATA/PG_VERSION" ]; then
		echo "[acervo] Criando o banco de dados em $PGDATA"
		# Acesso só por soquete local e 127.0.0.1, de dentro do contêiner.
		as_postgres "$PGBIN/initdb -D '$PGDATA' --encoding=UTF8 --locale=C.UTF-8 --auth-local=trust --auth-host=trust"
		echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
		FIRST_RUN=1
	fi

	as_postgres "$PGBIN/pg_ctl -D '$PGDATA' -w -t 120 -l '$PGDATA/postgresql.log' start"

	if [ "$FIRST_RUN" = "1" ]; then
		as_postgres "psql -q -f /opt/acervo/sql/createdatabase.sql"
		load_schema su postgres -s /bin/sh -c "psql -q -d biblivre4 -f /opt/acervo/sql/biblivre4.sql"
		as_postgres "psql -q -d biblivre4 -c \"$SKIP_SETUP_SQL\""
	fi
fi

# Plataformas como Cloud Run e Railway informam a porta HTTP pela variável PORT.
sed -i "s/<Connector port=\"[0-9]*\" protocol=\"HTTP\/1.1\"/<Connector port=\"$PORT\" protocol=\"HTTP\/1.1\"/" /usr/local/tomcat/conf/server.xml

stop_all() {
	echo "[acervo] Encerrando"
	/usr/local/tomcat/bin/catalina.sh stop 15 -force > /dev/null 2>&1 || true
	if [ "$DB_MODE" != "external" ]; then
		as_postgres "$PGBIN/pg_ctl -D '$PGDATA' -m fast -w stop" || true
	fi
	exit 0
}
trap stop_all TERM INT

echo "[acervo] Subindo o Tomcat na porta $PORT (caminho /acervo/), banco: $DB_MODE"
/usr/local/tomcat/bin/catalina.sh run &
wait $!
