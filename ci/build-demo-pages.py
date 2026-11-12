#!/usr/bin/env python3
"""Gera as páginas HTML da demonstração estática (docs/).

O painel do cadastro rápido é copiado de WebContent/jsp/cataloging/bibliographic.jsp,
para que a demonstração mostre sempre o mesmo formulário do sistema.
Chamado por ci/build-demo.sh.
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

jsp = (ROOT / "WebContent/jsp/cataloging/bibliographic.jsp").read_text(encoding="utf-8")
start = jsp.index('<div id="quick_add"')
end = jsp.index('<div class="page_title">')
panel = jsp[start:end].replace(' style="display: none;"', "", 1).rstrip()
assert "<%" not in panel, "o painel do cadastro rápido não pode conter código JSP"


def page(title, current, module, crumb, extra_css, body, scripts=""):
    def item(css_class, label, href, key):
        cur = " current" if key == current else ""
        return f'<li class="{css_class}{cur}"><a href="{href}">{label}</a></li>'

    return f'''<!doctype html>
<html lang="pt-BR">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=820">
	<meta name="robots" content="noindex">
	<title>{title} - Acervo Cidadão (demonstração)</title>
	<link rel="shortcut icon" type="image/x-icon" href="static/images/favicon.ico">
	<link rel="stylesheet" href="static/styles/biblivre.core.css">
{extra_css}	<link rel="stylesheet" href="demo.css">
</head>
<body>
<div id="demo_banner"><strong>Demonstração das telas.</strong> Esta página não é o sistema em produção: não há login e nada do que for digitado é gravado.</div>
<form>
	<div id="header">
		<div id="logo_biblivre" class="marca_seju">
			<a href="index.html">
				<span class="marca_estado">PARANÁ</span>
				<span class="marca_governo">Governo do Estado</span>
				<span class="marca_orgao">Justiça e Cidadania</span>
			</a>
		</div>
		<div id="logo_support"></div>
		<div id="logo_sponsor"></div>
		<div id="title">
			<h1><a href="index.html">Acervo Cidadão</a></h1>
			<h2>Biblioteca da Secretaria da Justiça</h2>
		</div>
		<div id="menu">
			<ul>
				{item("menu_start", "Início", "index.html", "inicio")}
				{item("menu_cataloging", "Catalogação", "cadastro.html", "cadastro")}
			</ul>
			<div id="slider_area"></div>
		</div>
	</div>

	<div id="notifications" class="notifications_{module}">
		<div id="messages"></div>
		<div id="breadcrumb">{crumb}</div>
	</div>

	<div id="content_outer">
		<div id="content">
			<div id="content_inner">
{body}
			</div>
		</div>
		<div id="copyright">
			<span class="orgao">Secretaria da Justiça e Cidadania</span> &middot; Governo do Estado do Paraná<br>
			Sistema baseado no <a href="http://biblivre.org.br" target="_blank" rel="noopener">Biblivre</a>, software livre sob licença GPLv3
		</div>
	</div>
</form>
{scripts}</body>
</html>
'''


def versioned(html):
    """Acrescenta ?v=<hash do conteúdo> aos arquivos locais, para que o
    navegador não use CSS ou script antigo depois de uma atualização."""
    def repl(match):
        attr, path = match.group(1), match.group(2)
        target = DOCS / path
        if not target.is_file():
            return match.group(0)
        digest = hashlib.sha1(target.read_bytes()).hexdigest()[:10]
        return f'{attr}="{path}?v={digest}"'

    return re.sub(r'(href|src)="((?:static/|demo\.)[^"?]+\.(?:css|js))"', repl, html)


(DOCS / "index.html").write_text(versioned(page(
    "Início", "inicio", "start", "<span>Início</span>",
    '\t<link rel="stylesheet" href="static/styles/biblivre.index.css">\n',
    '''				<div class="picture">
					<img src="static/images/main_picture_1.jpg" alt="">
				</div>
				<div class="text">
					<p>Bem-vindo ao <strong>Acervo Cidadão</strong>, o sistema de bibliotecas da Secretaria da Justiça e Cidadania do Estado do Paraná.</p>
					<p>Esta demonstração mostra a identidade visual do sistema e o <strong>cadastro rápido de livros</strong>: informe o ISBN e os dados do livro são buscados automaticamente.</p>
					<p class="home_shortcuts"><a class="main_button arrow_right" href="cadastro.html">Experimentar o cadastro rápido</a></p>
				</div>
				<div style="clear: both;"></div>''')), encoding="utf-8")

(DOCS / "cadastro.html").write_text(versioned(page(
    "Cadastro rápido", "cadastro", "cataloging", "<span>Catalogação</span> &gt; <a>Bibliográfica</a>",
    '\t<link rel="stylesheet" href="static/styles/biblivre.search.css">\n'
    '\t<link rel="stylesheet" href="static/styles/biblivre.cataloging.css">\n',
    '''				<div id="database_selection" style="position: relative; margin-top: 0; height: auto;">
					<div class="title">Base de dados: Principal</div>
					<div class="count" id="database_count" style="float: right; padding-top: 6px;"></div>
					<div class="clear"></div>
				</div>
''' + "\t\t" + panel.replace("\n", "\n\t\t") + '''

				<div id="demo_list" class="biblivre_form">
					<fieldset>
						<legend>Livros cadastrados nesta demonstração</legend>
						<table>
							<thead><tr><th>Título</th><th>Autor</th><th>Ano</th><th>Exemplares</th></tr></thead>
							<tbody id="demo_list_body"></tbody>
						</table>
					</fieldset>
				</div>''',
    '<script src="static/scripts/jquery.js"></script>\n'
    '<script src="static/scripts/biblivre.cataloging.isbn_lookup.js"></script>\n'
    '<script src="static/scripts/biblivre.cataloging.quick_add.js"></script>\n'
    '<script src="demo.js"></script>\n')), encoding="utf-8")

print("páginas da demonstração geradas")
