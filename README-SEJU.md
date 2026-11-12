# Acervo Cidadão – SEJU

Versão do Biblivre 5 adaptada para a Secretaria da Justiça e Cidadania do Estado do Paraná (SEJU).

- **Base:** [Biblivre-org/Biblivre5x](https://github.com/Biblivre-org/Biblivre5x), commit `7512d0f` (5.1.31).
- **Licença:** GPLv3, a mesma do projeto original (arquivo `LICENSE`). Os créditos do Biblivre foram mantidos em *Ajuda > Sobre*.
- **Build e instalação:** iguais aos do Biblivre5x, descritos em `README.md` (`mvn clean package`, Tomcat, PostgreSQL).

## O que mudou

### Identidade visual

| Onde | Arquivo |
| --- | --- |
| Paleta do Governo do Paraná (variáveis `$gov-*`) | `WebContent/static/styles/scss/_biblivre.scss` |
| Cabeçalho, barra de menu, submenus, cores dos módulos | `WebContent/static/styles/scss/interface/_menu.scss` |
| Botão principal | `WebContent/static/styles/scss/interface/_buttons.scss` |
| Rodapé | `WebContent/static/styles/scss/interface/_content.scss` e `WebContent/jsp/taglib/layout/body/end.jsp` |
| Marca no cabeçalho, remoção dos logotipos de patrocinadores | `WebContent/jsp/taglib/layout/body/start.jsp` |
| Páginas de erro | `WebContent/jsp/error_404.jsp`, `WebContent/jsp/error_fatal.jsp` |
| Aviso de versão modificada | `WebContent/jsp/help/about_biblivre.jsp` |
| Ícone da aba do navegador | `WebContent/static/images/favicon.ico` |

As cores seguem o *Manual de Identidade Visual dos Sites e Aplicativos do Governo do Paraná* (jun/2021), seção "Secretarias": azul `#0072BB`, ciano `#00AEEF`, verde `#009B54`/`#068833`, textos `#333`/`#555`/`#666`.

Os CSS são gerados no build pelo `dart-sass-maven-plugin`; não há CSS compilado no repositório.

### Marca oficial

O cabeçalho usa uma assinatura em texto ("PARANÁ / Governo do Estado / Justiça e Cidadania") até que a arte oficial seja instalada. Para usar a marca oficial, copie o arquivo fornecido pela Comunicação para:

```
WebContent/static/images/marca_seju.png
```

Altura útil de 52 px e largura máxima de 117 px (use um PNG com o dobro disso para telas de alta densidade). Não é preciso alterar código: o cabeçalho detecta o arquivo.

A fonte padrão do manual é a Proxima Nova, que é licenciada. O sistema a usa se estiver instalada na máquina do usuário e, caso contrário, recorre a Segoe UI / Roboto / Helvetica / Arial.

### Nome do sistema

Instalações novas já nascem com o título "Acervo Cidadão" e o subtítulo "Biblioteca da Secretaria da Justiça". Em instalações existentes, ajuste em *Administração > Configurações*.

Os textos da página inicial em português são regravados uma única vez pela atualização `seju-1.0.0` (`biblivre.update.seju_1_0_0.Update`) e continuam editáveis em *Administração > Traduções*.

### Cadastro rápido de livro

Em *Catalogação > Bibliográfica* há um botão **Cadastro rápido** (e, para funcionários, um atalho **Cadastrar livro** na página inicial). Ele abre um formulário em linguagem comum; só o título é obrigatório.

- **Preenchimento pelo ISBN.** Digite o ISBN e tecle Enter (ou *Buscar dados*): título, subtítulo, autores, editora, cidade, ano e assunto são preenchidos para conferência. O nome do autor é invertido para "Sobrenome, Nome", e os demais autores entram como entradas secundárias (campo 700).
- **Leitura do código de barras pela câmera**, nos navegadores que têm leitor embutido (Chrome no Android, por exemplo) e com o sistema servido por HTTPS. Onde não há suporte, o botão não aparece.
- **Manter dados para o próximo livro** (editora, cidade, ano, assunto e localização), útil para cadastrar uma coleção em sequência.
- Ao salvar, o livro e os exemplares são criados de uma vez e o formulário fica pronto para o próximo.
- O registro é gravado no mesmo formato MARC do formulário completo (campos 020, 090, 100, 245, 250, 260, 650 e 700) e pode ser complementado depois em *Editar*.
- Não há código novo no servidor: a tela usa as ações `save` e `create_automatic_holding` que o Biblivre já tinha, com as mesmas permissões.

A consulta por ISBN é feita pelo navegador de quem cadastra, em bases públicas e sem chave de acesso: Mercado Editorial, Open Library e Câmara Brasileira do Livro (as três pela BrasilAPI) e Google Books. Elas são consultadas ao mesmo tempo e os resultados são combinados, porque nenhuma é completa sozinha: a CBL cobre quase todo livro brasileiro, mas costuma trazer só título e editora; o Google Books sem chave tem cota diária e muitas vezes recusa a consulta. Só o número do ISBN sai da rede da Secretaria. Se a rede bloquear esses endereços (`brasilapi.com.br` e `www.googleapis.com`), o formulário avisa e segue funcionando com preenchimento manual.

Arquivos: `WebContent/jsp/cataloging/bibliographic.jsp`, `WebContent/static/scripts/biblivre.cataloging.quick_add.js`, `WebContent/static/scripts/biblivre.cataloging.isbn_lookup.js`, `WebContent/static/styles/scss/biblivre.cataloging.scss`, `WebContent/jsp/index.jsp`.

### Administrador

Em instalações novas, o administrador (login de id 1) passa a ser `salomaohurmann@seju.pr.gov.br` em vez de `admin`. A senha inicial continua sendo a padrão do Biblivre e **deve ser trocada no primeiro acesso** (o sistema exibe um aviso enquanto isso não for feito). Em instalações existentes o login não muda.

### Build

O `pom.xml` usa o repositório Clojars por HTTPS (o Maven atual bloqueia HTTP) e o GitHub Actions compila o projeto a cada push e publica o `.war` como artefato.

### Segurança

**Senhas de usuários.** Passam a ser gravadas com PBKDF2-HMAC-SHA256, 210.000 iterações e sal aleatório de 16 bytes, no formato `pbkdf2_sha256$iterações$sal$hash`. Antes eram SHA-1 sem sal.

- Não há migração manual: as senhas antigas continuam válidas e cada uma é convertida no primeiro login bem-sucedido do usuário.
- Arquivos: `biblivre/core/utils/TextUtils.java`, `biblivre/login/LoginDAO.java`, `biblivre/login/LoginBO.java`.
- Depois da conversão, o banco não pode voltar para uma versão sem esta alteração (o Biblivre original não reconhece o novo formato).

**Senha do banco de dados.** Os utilitários `pg_dump`/`psql` (backup, restauração, criação de bibliotecas) deixaram de usar a senha fixa no código. A senha é lida, nesta ordem, de:

1. propriedade de sistema `biblivre.db.password` (ex.: `-Dbiblivre.db.password=...` em `CATALINA_OPTS`);
2. variável de ambiente `BIBLIVRE_DB_PASSWORD`;
3. valor padrão do Biblivre, se nenhuma das duas existir.

Em produção:

1. troque a senha do usuário `biblivre` no PostgreSQL (`ALTER ROLE biblivre PASSWORD '...'`);
2. coloque a mesma senha em `WebContent/META-INF/context.xml` (três ocorrências de `dataSource.password`);
3. defina `BIBLIVRE_DB_PASSWORD` no serviço do Tomcat;
4. troque a senha do usuário `admin` do sistema no primeiro acesso.

### Login com conta Google (@seju.pr.gov.br)

Com `ACERVO_GOOGLE_CLIENT_ID` e `ACERVO_GOOGLE_CLIENT_SECRET` definidos, o sistema passa a aceitar **somente** login com conta Google do domínio institucional; usuário e senha do Biblivre deixam de funcionar (inclusive a senha padrão).

- Contas pessoais (@gmail.com) e de outros domínios do Google Workspace são recusadas no servidor, pelo campo `hd` do Google e pelo sufixo do e-mail.
- No primeiro acesso a pessoa é cadastrada automaticamente como **leitor** (pesquisa e reservas). Para virar funcionário, o administrador ajusta em *Circulação > Cadastro de usuários* e *Administração > Permissões*.
- O e-mail em `ACERVO_ADMIN_EMAIL` (padrão `salomaohurmann@seju.pr.gov.br`) entra como administrador.

| Variável | Para quê |
| --- | --- |
| `ACERVO_GOOGLE_CLIENT_ID` | ID do cliente OAuth, tipo "Aplicativo da Web" |
| `ACERVO_GOOGLE_CLIENT_SECRET` | chave secreta do cliente |
| `ACERVO_GOOGLE_DOMAIN` | domínio aceito (padrão `seju.pr.gov.br`) |
| `ACERVO_ADMIN_EMAIL` | e-mail do administrador |
| `ACERVO_PUBLIC_URL` | endereço público, ex. `https://exemplo.run.app/acervo/` |

No cliente OAuth do Google Cloud, cadastre como URI de redirecionamento autorizado: `{ACERVO_PUBLIC_URL}sso/google-callback`.

Arquivos: `biblivre/login/GoogleLogin.java`, `biblivre/login/Handler.java` (`googleStart`, `googleCallback`), `WebContent/WEB-INF/tags/menu/login.tag`, `WebContent/jsp/redirect.jsp`.

## Demonstração estática (GitHub Pages)

A pasta `docs/` contém uma demonstração das telas que funciona sem servidor e sem banco: página inicial e cadastro rápido de livro. Ela usa o CSS compilado do tema e o script real do cadastro rápido, com o servidor simulado em `docs/demo.js`. Não há login e nada é gravado; os livros digitados ficam só na memória da página.

- Publicação: no repositório, *Settings > Pages > Deploy from a branch*, branch `main`, pasta `/docs`.
- Depois de alterar o tema ou o cadastro rápido, regere os arquivos com `sh ci/build-demo.sh`. As páginas são geradas por `ci/build-demo-pages.py`, que copia o painel do cadastro rápido da tela real.
- Na demonstração a consulta por ISBN é de verdade; só a gravação é simulada.

## Hospedagem (Docker)

O `Dockerfile` gera uma imagem única com Tomcat 9 e PostgreSQL. O banco roda dentro do contêiner, acessível só por ele, porque o Biblivre usa `pg_dump`/`psql` locais e endereço fixo `127.0.0.1`. Na primeira execução o banco é criado automaticamente.

- Endereço: `http://<host>/acervo/` (a raiz redireciona para lá).
- Dados: ficam em `/data`. **Monte um volume persistente em `/data`**; sem ele, o acervo é apagado a cada novo deploy.
- Porta: 8080, ou a da variável `PORT` quando a plataforma define uma.
- Memória: reserve ao menos 1 GB.

Teste local:

```
docker build -t acervo-cidadao .
docker run -d -p 8080:8080 -v acervo-dados:/data acervo-cidadao
```

Google Cloud (Cloud Run + Cloud SQL):

1. Cloud SQL: instância PostgreSQL 16, banco `biblivre4` e usuário `biblivre` com senha só de letras, números e `. _ ~ -`.
2. Cloud Run: serviço a partir deste repositório (Dockerfile), porta 8080, 1 GiB de memória, **no máximo 1 instância** (as sessões ficam na memória do servidor) e a instância do Cloud SQL adicionada em *Conexões*.
3. Variáveis do serviço: `ACERVO_DB=external`, `CLOUD_SQL_INSTANCE=projeto:região:instância`, `BIBLIVRE_DB_PASSWORD`, e as do login com Google acima.
4. Na primeira subida o contêiner cria as tabelas no Cloud SQL. O endereço é `https://<serviço>.run.app/acervo/`.

No modo `external` os dados ficam no Cloud SQL, que tem backup automático próprio; o backup pela tela do Biblivre grava em disco temporário do contêiner e deve ser baixado na hora.

Railway:

1. *New Project > Deploy from GitHub repo* e escolha o repositório. O Railway detecta o `Dockerfile`.
2. No serviço, crie um *Volume* com *mount path* `/data`.
3. Em *Settings > Networking*, gere o domínio público.
4. Acesse `https://<domínio>/acervo/`, entre com o login do administrador e troque a senha.

O contêiner já sobe com a instalação inicial concluída: o assistente de instalação do Biblivre, que funciona sem login, não fica exposto.

O GitHub Actions constrói essa imagem a cada push e roda dois testes com o sistema de pé: `ci/smoke-test.sh` (banco interno e login por senha) e `ci/smoke-test-google.sh` (banco externo com usuário sem superusuário e login só com Google, usando um Google simulado).

## Verificação feita e pendências

- A cada push o GitHub Actions compila o projeto (`mvn clean package`), monta a imagem Docker e roda `ci/smoke-test.sh` com o sistema de pé (Tomcat + PostgreSQL): página inicial, login do administrador, cadastro de um livro com exemplares pelo mesmo caminho do cadastro rápido, recusa de senha errada e segundo login com a senha já migrada para PBKDF2.
- O tema e a demonstração estática foram conferidos em navegador.
- O login com Google foi testado de ponta a ponta com um servidor que simula o Google (domínio aceito, contas recusadas, criação de leitor, administrador). A troca real com o Google só acontece no ambiente hospedado.
- Ainda não foram exercitados com o sistema rodando: a tela do cadastro rápido no navegador (só as chamadas que ela faz), troca de senha pela tela, backup e restauração, e o assistente de configuração inicial. Valide esses pontos em homologação antes de usar com dados reais.
- O layout continua com largura fixa de 782 px, como no Biblivre original; não há versão para celular.
