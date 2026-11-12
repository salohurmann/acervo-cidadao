/*
 * Demonstração estática do Acervo Cidadão (GitHub Pages).
 *
 * Carrega o script real do cadastro rápido e troca apenas o que depende do
 * servidor: as chamadas $.ajax respondem com sucesso simulado e os livros
 * ficam só na memória desta página. Nada é gravado em lugar nenhum.
 */
var DemoBooks = [];

var Core = {
	msg: function(o, level) {
		var config = (typeof o == 'object') ? o : { message: o, message_level: level || 'normal' };
		$('#messages .message').remove();
		$('<div class="message"></div>')
			.addClass(config.message_level || 'normal')
			.append($('<div></div>').text(config.message || ''))
			.appendTo('#messages');
	},
	formErrors: function() {},
	fixResize: function() {}
};

var CatalogingInput = {
	getCurrentDatabase: function() { return 'main'; },
	updateDatabaseCount: function() {
		$('#database_count').html('<strong>' + DemoBooks.length + '</strong> ' + (DemoBooks.length == 1 ? 'registro' : 'registros') + ' nesta demonstração');
	}
};

var CatalogingSearch = {
	redoSearch: function() {
		var list = $('#demo_list_body').empty();

		if (DemoBooks.length == 0) {
			list.append('<tr><td colspan="4" class="empty">Nenhum livro cadastrado ainda. Use o formulário acima.</td></tr>');
			return;
		}

		for (var i = DemoBooks.length - 1; i >= 0; i--) {
			var book = DemoBooks[i];
			var row = $('<tr></tr>');
			$('<td></td>').text(book.title).appendTo(row);
			$('<td></td>').text(book.author).appendTo(row);
			$('<td></td>').text(book.year).appendTo(row);
			$('<td></td>').text(book.copies).appendTo(row);
			list.append(row);
		}
	}
};

// Servidor simulado: responde às duas ações usadas pelo cadastro rápido.
$.ajax = function(options) {
	var deferred = $.Deferred();
	var data = options.data || {};
	var response = { success: true };

	if (data.action == 'save') {
		var marc = JSON.parse(data.data);
		var first = function(tag, subfield) {
			return (marc[tag] && marc[tag][0][subfield]) ? marc[tag][0][subfield][0] : '';
		};

		DemoBooks.push({ title: first('245', 'a'), author: first('100', 'a'), year: first('260', 'c'), copies: 0 });
		response.data = { id: DemoBooks.length };
	} else if (data.action == 'create_automatic_holding') {
		DemoBooks[data.record_id - 1].copies = data.holding_count;
	}

	setTimeout(function() {
		deferred.resolveWith(options.context || window, [response]);
	}, 250);

	return deferred.promise();
};

$(document).ready(function() {
	$('#quick_add').keypress(function(e) {
		if (e.keyCode == 13) {
			e.preventDefault();
			QuickAdd.save();
		}
	});

	$('form').submit(function(e) { e.preventDefault(); });

	// Na demonstração o formulário fica sempre aberto.
	QuickAdd.open = function() { QuickAdd.input('quick_isbn').focus(); };
	QuickAdd.close = function() { QuickAdd.clear(); };

	CatalogingInput.updateDatabaseCount();
	CatalogingSearch.redoSearch();
});
