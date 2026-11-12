# Acervo Cidadão (SEJU) - imagem com Tomcat e, opcionalmente, PostgreSQL.
#
# Dois modos de banco, escolhidos pela variável ACERVO_DB:
#
#   local    (padrão) O PostgreSQL roda dentro do contêiner e guarda os dados
#            em /data; monte um volume nesse caminho.
#   external O banco é um PostgreSQL de fora, como o Cloud SQL. O Biblivre
#            sempre conecta em 127.0.0.1:5432, então o contêiner faz a ponte:
#            com CLOUD_SQL_INSTANCE definido, liga essa porta ao soquete que o
#            Cloud Run monta em /cloudsql/<instância>.
#
# Variáveis: ver docker/entrypoint.sh e README-SEJU.md.

# ---------- build ----------
FROM maven:3.9-eclipse-temurin-8 AS build
WORKDIR /src
COPY pom.xml .
COPY lib ./lib
COPY src ./src
COPY WebContent ./WebContent
RUN mvn -B -DskipTests clean package

# ---------- runtime ----------
FROM tomcat:9.0-jdk8-temurin

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends postgresql postgresql-client socat \
 && rm -rf /var/lib/apt/lists/* \
 && rm -rf /usr/local/tomcat/webapps/*

# O WAR é aberto na construção para que o entrypoint possa ajustar a senha
# do banco em META-INF/context.xml antes de o Tomcat subir.
COPY --from=build /src/target/Biblivre5x.war /tmp/acervo.war
RUN mkdir -p /usr/local/tomcat/webapps/acervo \
 && cd /usr/local/tomcat/webapps/acervo \
 && jar xf /tmp/acervo.war \
 && rm /tmp/acervo.war

COPY sql /opt/acervo/sql
COPY docker/root-index.html /usr/local/tomcat/webapps/ROOT/index.html
COPY docker/entrypoint.sh /opt/acervo/entrypoint.sh
RUN chmod +x /opt/acervo/entrypoint.sh

ENV PGDATA=/data/pgdata \
    CATALINA_OPTS="-Xms128m -Xmx512m -Dfile.encoding=UTF-8 -Duser.timezone=America/Sao_Paulo" \
    TZ=America/Sao_Paulo

# Sem instrução VOLUME: o Railway não a aceita; o volume é montado em /data
# pela própria plataforma (ou com -v no docker run).
EXPOSE 8080

ENTRYPOINT ["/opt/acervo/entrypoint.sh"]
