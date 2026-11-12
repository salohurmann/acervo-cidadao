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

Em *Catalogação > Bibliográfica* há um botão **Cadastro rápido**. Ele abre um formulário de onze campos em linguagem comum (título, subtítulo, autor, editora, cidade, ano, edição, ISBN, assunto, localização na estante e quantidade de exemplares). Só o título é obrigatório.

- Ao salvar, o livro e os exemplares são criados de uma vez e o formulário fica limpo para o próximo.
- O registro é gravado no mesmo formato MARC do formulário completo (campos 020, 090, 100, 245, 250, 260 e 650) e pode ser complementado depois em *Editar*.
- Não há código novo no servidor: a tela usa as ações `save` e `create_automatic_holding` que o Biblivre já tinha, com as mesmas permissões.
- Arquivos: `WebContent/jsp/cataloging/bibliographic.jsp`, `WebContent/static/scripts/biblivre.cataloging.quick_add.js`, `WebContent/static/styles/scss/biblivre.cataloging.scss`.

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

## Demonstração estática (GitHub Pages)

A pasta `docs/` contém uma demonstração das telas que funciona sem servidor e sem banco: página inicial e cadastro rápido de livro. Ela usa o CSS compilado do tema e o script real do cadastro rápido, com o servidor simulado em `docs/demo.js`. Não há login e nada é gravado; os livros digitados ficam só na memória da página.

- Publicação: no repositório, *Settings > Pages > Deploy from a branch*, branch `main`, pasta `/docs`.
- Depois de alterar o tema ou o cadastro rápido, regere os arquivos com `sh ci/build-demo.sh`.

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

Railway:

1. *New Project > Deploy from GitHub repo* e escolha o repositório. O Railway detecta o `Dockerfile`.
2. No serviço, crie um *Volume* com *mount path* `/data`.
3. Em *Settings > Networking*, gere o domínio público.
4. Acesse `https://<domínio>/acervo/`, entre com o login do administrador e troque a senha.

O GitHub Actions constrói essa imagem a cada push e roda `ci/smoke-test.sh`: página inicial, login, cadastro de um livro com exemplares, recusa de senha errada e segundo login com a senha já migrada.

## Verificação feita e pendências

- O tema foi compilado com dart-sass 1.72.0 (mesma versão do build) e conferido em navegador com uma página estática que reproduz cabeçalho, menu, botões e rodapé.
- O código de senhas foi testado isoladamente, inclusive contra o hash do `admin` padrão do `sql/biblivre4.sql`.
- O cadastro rápido foi conferido só no visual e no JSON que envia; a gravação no servidor não foi exercitada.
- O `Dockerfile` e o teste de fumaça foram escritos sem poder ser executados; a primeira execução real é a do GitHub Actions.
- **O build Maven completo e o sistema em execução (Tomcat + PostgreSQL) não foram testados** no ambiente em que as alterações foram feitas. Rode `mvn clean package`, suba em homologação e valide login, troca de senha, cadastro rápido, backup e restauração antes de publicar.
- O layout continua com largura fixa de 782 px, como no Biblivre original; não há versão para celular.
