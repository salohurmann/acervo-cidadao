# Acervo Cidadão (SEJU) - imagem única com Tomcat e PostgreSQL.
#
# O Biblivre chama pg_dump/psql locais e conecta em 127.0.0.1:5432 com nomes
# fixos de banco e usuário; por isso o PostgreSQL roda dentro do mesmo
# contêiner e não fica exposto para fora. Os dados ficam em /data: monte um
# volume nesse caminho para que sobrevivam a novos deploys.

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
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends postgresql postgresql-client \
 && rm -rf /var/lib/apt/lists/* \
 && rm -rf /usr/local/tomcat/webapps/*

COPY --from=build /src/target/Biblivre5x.war /usr/local/tomcat/webapps/acervo.war
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
