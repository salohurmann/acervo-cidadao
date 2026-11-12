/**
 * Este arquivo é parte do Biblivre5 (versão SEJU - Acervo Cidadão).
 *
 * Biblivre5 é um software livre; você pode redistribuí-lo e/ou
 * modificá-lo dentro dos termos da Licença Pública Geral GNU como
 * publicada pela Fundação do Software Livre (FSF); na versão 3 da
 * Licença, ou (caso queira) qualquer versão posterior.
 *
 * Cadastro rápido de livro.
 *
 * Formulário enxuto para quem não conhece MARC: monta o mesmo JSON que o
 * formulário completo de catalogação envia e usa as mesmas ações do servidor
 * ("save" de cataloging.bibliographic e "create_automatic_holding" de
 * cataloging.holding). Nenhuma regra de gravação foi duplicada aqui; o
 * registro criado pode ser aberto e complementado depois pelo formulário
 * completo.
 */
var QuickAdd = {
	root: '#quick_add',
	saving: false,

	// Campo do formulário rápido -> campo/subcampo MARC.
	fields: [
		{ name: 'quick_isbn',      tag: '020', subfield: 'a' },
		{ name: 'quick_location',  tag: '090', subfield: 'a' },
		{ name: 'quick_author',    tag: '100', subfield: 'a' },
		{ name: 'quick_title',     tag: '245', subfield: 'a' },
		{ name: 'quick_subtitle',  tag: '245', subfield: 'b' },
		{ name: 'quick_edition',   tag: '250', subfield: 'a' },
		{ name: 'quick_place',     tag: '260', subfield: 'a' },
		{ name: 'quick_publisher', tag: '260', subfield: 'b' },
		{ name: 'quick_year',      tag: '260', subfield: 'c' },
		{ name: 'quick_subject',   tag: '650', subfield: 'a' }
	],

	getRoot: function() {
		return $(this.root);
	},

	input: function(name) {
		return this.getRoot().find(':input[name="' + name + '"]');
	},

	value: function(name) {
		return $.trim(this.input(name).val() || '');
	},

	open: function() {
		// Durante a edição de um registro o botão "Novo" fica desabilitado;
		// o cadastro rápido segue a mesma regra.
		if ($('#new_record_button').hasClass('disabled')) {
			return;
		}

		if (CatalogingInput.getCurrentDatabase() == 'trash') {
			Core.msg('Escolha outra base de dados (Principal, Trabalho ou Privada) para cadastrar um livro.', 'warning');
			return;
		}

		this.clearErrors();
		this.getRoot().slideDown('fast', function() {
			QuickAdd.input('quick_title').focus();
			Core.fixResize();
		});
	},

	close: function() {
		this.clearErrors();
		this.getRoot().slideUp('fast', function() {
			Core.fixResize();
		});
	},

	clear: function() {
		this.getRoot().find('input[type="text"]').val('');
		this.input('quick_copies').val('1');
		this.clearErrors();
	},

	clearErrors: function() {
		this.getRoot().find('.quick_error').text('');
		this.getRoot().find('.value_error').removeClass('value_error');
	},

	showError: function(name, text) {
		var input = this.input(name);

		input.addClass('value_error');
		input.closest('.field').find('.quick_error').text(text);
	},

	validate: function() {
		var valid = true;
		var first = null;

		this.clearErrors();

		if (!this.value('quick_title')) {
			this.showError('quick_title', 'Informe o título do livro.');
			first = first || 'quick_title';
			valid = false;
		}

		var year = this.value('quick_year');
		if (year && !/^\d{4}$/.test(year)) {
			this.showError('quick_year', 'Use quatro dígitos, por exemplo 2024.');
			first = first || 'quick_year';
			valid = false;
		}

		var copies = this.value('quick_copies');
		if (!/^\d{1,2}$/.test(copies)) {
			this.showError('quick_copies', 'Informe um número de 0 a 99.');
			first = first || 'quick_copies';
			valid = false;
		}

		if (first) {
			this.input(first).focus();
		}

		return valid;
	},

	// Mesmo formato produzido por CatalogingInput.createJson().
	createJson: function() {
		var json = {};

		for (var i = 0; i < this.fields.length; i++) {
			var field = this.fields[i];
			var value = this.value(field.name);

			if (!value) {
				continue;
			}

			if (!json[field.tag]) {
				json[field.tag] = [{}];
			}

			json[field.tag][0][field.subfield] = [value];
		}

		// Indicadores: autor com entrada pelo sobrenome e título com entrada
		// secundária quando há autor, como no formulário completo.
		if (json['100']) {
			json['100'][0].ind1 = '1';
		}

		json['245'][0].ind1 = json['100'] ? '1' : '0';
		json['245'][0].ind2 = '0';

		return JSON.stringify(json);
	},

	save: function() {
		if (this.saving || !this.getRoot().is(':visible') || !this.validate()) {
			return;
		}

		var database = CatalogingInput.getCurrentDatabase();
		var copies = parseInt(this.value('quick_copies'), 10);
		var title = this.value('quick_title');

		this.saving = true;

		$.ajax({
			url: window.location.pathname,
			type: 'POST',
			dataType: 'json',
			data: {
				controller: 'json',
				module: 'cataloging.bibliographic',
				action: 'save',
				id: 0,
				from: 'form',
				material_type: 'book',
				database: database,
				data: this.createJson()
			},
			loadingTimedOverlay: true,
			context: this
		}).done(function(response) {
			if (!response || !response.success || !response.data) {
				this.saving = false;
				Core.formErrors(response && response.errors);
				Core.msg(response || { message: 'Não foi possível salvar o livro.', message_level: 'warning' });
				return;
			}

			if (copies > 0) {
				this.createHoldings(response.data.id, database, copies, title);
			} else {
				this.finish(title, 0, true);
			}
		}).fail(function() {
			this.saving = false;
			Core.msg('Não foi possível salvar o livro. Verifique a conexão e tente novamente.', 'error');
		});
	},

	createHoldings: function(recordId, database, copies, title) {
		$.ajax({
			url: window.location.pathname,
			type: 'POST',
			dataType: 'json',
			data: {
				controller: 'json',
				module: 'cataloging.holding',
				action: 'create_automatic_holding',
				record_id: recordId,
				database: database,
				holding_count: copies
			},
			loadingTimedOverlay: true,
			context: this
		}).done(function(response) {
			this.finish(title, copies, !!(response && response.success));
		}).fail(function() {
			this.finish(title, copies, false);
		});
	},

	finish: function(title, copies, holdingsCreated) {
		this.saving = false;

		if (!holdingsCreated) {
			// O registro do livro foi gravado; só os exemplares falharam.
			Core.msg('O livro "' + title + '" foi cadastrado, mas os exemplares não foram criados. ' +
				'Abra o registro e inclua os exemplares na aba "Exemplares".', 'warning');
		} else if (copies == 0) {
			Core.msg('Livro "' + title + '" cadastrado, sem exemplares.', 'success');
		} else if (copies == 1) {
			Core.msg('Livro "' + title + '" cadastrado com 1 exemplar.', 'success');
		} else {
			Core.msg('Livro "' + title + '" cadastrado com ' + copies + ' exemplares.', 'success');
		}

		this.clear();
		this.input('quick_title').focus();

		CatalogingInput.updateDatabaseCount();
		CatalogingSearch.redoSearch();
	}
};
