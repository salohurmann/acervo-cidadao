#!/bin/sh
# Inicializa o PostgreSQL interno (na primeira execução) e sobe o Tomcat.
set -e

PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -n 1)"
PGDATA="${PGDATA:-/data/pgdata}"
PORT="${PORT:-8080}"

mkdir -p "$PGDATA" /var/run/postgresql
chown -R postgres:postgres "$(dirname "$PGDATA")" /var/run/postgresql
chmod 700 "$PGDATA"

as_postgres() {
	su postgres -s /bin/sh -c "$1"
}

FIRST_RUN=0
if [ ! -s "$PGDATA/PG_VERSION" ]; then
	echo "[acervo] Criando o banco de dados em $PGDATA"
	# Acesso só por socket local e 127.0.0.1, de dentro do contêiner.
	as_postgres "$PGBIN/initdb -D '$PGDATA' --encoding=UTF8 --locale=C.UTF-8 --auth-local=trust --auth-host=trust"
	echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
	FIRST_RUN=1
fi

as_postgres "$PGBIN/pg_ctl -D '$PGDATA' -w -t 120 -l '$PGDATA/postgresql.log' start"

if [ "$FIRST_RUN" = "1" ]; then
	echo "[acervo] Carregando a estrutura inicial do Acervo Cidadão"
	as_postgres "psql -q -f /opt/acervo/sql/createdatabase.sql"
	as_postgres "psql -q -d biblivre4 -f /opt/acervo/sql/biblivre4.sql" > /dev/null
	echo "[acervo] Banco de dados pronto"
fi

# Plataformas como o Railway informam a porta HTTP pela variável PORT.
sed -i "s/<Connector port=\"[0-9]*\" protocol=\"HTTP\/1.1\"/<Connector port=\"$PORT\" protocol=\"HTTP\/1.1\"/" /usr/local/tomcat/conf/server.xml

stop_all() {
	echo "[acervo] Encerrando"
	/usr/local/tomcat/bin/catalina.sh stop 15 -force > /dev/null 2>&1 || true
	as_postgres "$PGBIN/pg_ctl -D '$PGDATA' -m fast -w stop" || true
	exit 0
}
trap stop_all TERM INT

echo "[acervo] Subindo o Tomcat na porta $PORT (caminho /acervo/)"
/usr/local/tomcat/bin/catalina.sh run &
wait $!
