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
 *
 * O ISBN pode ser digitado ou lido pela câmera (código de barras); os dados
 * do livro são então buscados por IsbnLookup e preenchidos para conferência.
 */
var QuickAdd = {
	root: '#quick_add',
	saving: false,
	searching: false,

	// Autores além do primeiro, vindos da consulta por ISBN (campo MARC 700).
	extraAuthors: [],

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

	// Campos preservados quando "manter para o próximo" está marcado.
	keptFields: ['quick_publisher', 'quick_place', 'quick_year', 'quick_subject', 'quick_location'],

	getRoot: function() {
		return $(this.root);
	},

	input: function(name) {
		return this.getRoot().find(':input[name="' + name + '"]');
	},

	value: function(name) {
		return $.trim(this.input(name).val() || '');
	},

	init: function() {
		var root = this.getRoot();

		if (root.length == 0) {
			return;
		}

		// No campo ISBN, Enter busca os dados em vez de salvar.
		this.input('quick_isbn').keypress(function(e) {
			if (e.keyCode == 10 || e.keyCode == 13) {
				e.preventDefault();
				e.stopPropagation();
				QuickAdd.lookupIsbn();
			}
		});

		this.input('quick_author').bind('change', function() {
			QuickAdd.setExtraAuthors([]);
		});

		if (!this.scanSupported()) {
			root.find('.quick_scan_button').hide();
		}

		// Atalho da página inicial: ?action=cataloging_bibliographic&quick=1
		if (/[?&]quick=1(&|$)/.test(window.location.search)) {
			setTimeout(function() {
				QuickAdd.open();
			}, 0);
		}
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
			QuickAdd.input('quick_isbn').focus();
			Core.fixResize();
		});
	},

	close: function() {
		this.stopScan();
		this.clearErrors();
		this.getRoot().slideUp('fast', function() {
			Core.fixResize();
		});
	},

	clear: function() {
		var keep = this.input('quick_keep').is(':checked');
		var kept = this.keptFields;

		this.getRoot().find('input[type="text"]').each(function() {
			var input = $(this);

			if (!keep || $.inArray(input.attr('name'), kept) == -1) {
				input.val('');
			}
		});

		this.input('quick_copies').val('1');
		this.setExtraAuthors([]);
		this.setStatus('');
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

	setStatus: function(text, level) {
		this.getRoot().find('.quick_status')
			.removeClass('quick_status_ok quick_status_warn')
			.addClass(level ? 'quick_status_' + level : '')
			.text(text || '');
	},

	setExtraAuthors: function(authors) {
		this.extraAuthors = authors || [];

		var hint = '';

		if (this.extraAuthors.length == 1) {
			hint = '+ 1 autor: ' + this.extraAuthors[0];
		} else if (this.extraAuthors.length > 1) {
			hint = '+ ' + this.extraAuthors.length + ' autores: ' + this.extraAuthors.join('; ');
		}

		this.getRoot().find('.quick_extra_authors').text(hint);
	},

	// ------------------------------------------------------------------ ISBN

	lookupIsbn: function() {
		if (this.searching) {
			return;
		}

		this.clearErrors();

		var isbn = IsbnLookup.normalize(this.value('quick_isbn'));

		if (!isbn) {
			this.showError('quick_isbn', 'ISBN inválido. Confira os 10 ou 13 dígitos.');
			this.input('quick_isbn').focus();
			return;
		}

		this.input('quick_isbn').val(isbn);
		this.searching = true;
		this.setStatus('Buscando os dados do livro...');

		IsbnLookup.lookup(isbn, function(book, reason) {
			QuickAdd.searching = false;

			if (book) {
				QuickAdd.applyBook(book);
			} else if (reason == 'unavailable') {
				QuickAdd.setStatus('Não consegui consultar as bases de ISBN agora. Preencha os dados à mão ou tente de novo.', 'warn');
				QuickAdd.input('quick_title').focus();
			} else {
				QuickAdd.setStatus('Esse ISBN não está nas bases consultadas. Preencha os dados à mão.', 'warn');
				QuickAdd.input('quick_title').focus();
			}
		});
	},

	// Preenche o formulário com o que a consulta devolveu. Os dados do livro
	// anterior são limpos antes, para não se misturarem com os do novo; os
	// campos marcados para manter só mudam se a consulta trouxer valor.
	applyBook: function(book) {
		var keep = this.input('quick_keep').is(':checked');
		var names = ['quick_title', 'quick_subtitle', 'quick_author', 'quick_edition', 'quick_publisher', 'quick_place', 'quick_year', 'quick_subject'];

		for (var i = 0; i < names.length; i++) {
			if (!keep || $.inArray(names[i], this.keptFields) == -1) {
				this.input(names[i]).val('');
			}
		}

		this.setExtraAuthors([]);
		this.clearErrors();

		var set = function(name, value) {
			if (value) {
				QuickAdd.input(name).val(value);
			}
		};

		set('quick_isbn', book.isbn);
		set('quick_title', book.title);
		set('quick_subtitle', book.subtitle);
		set('quick_edition', book.edition);
		set('quick_publisher', book.publisher);
		set('quick_place', book.place);
		set('quick_year', book.year);
		set('quick_subject', book.subject);

		if (book.authors && book.authors.length > 0) {
			this.input('quick_author').val(book.authors[0]);
			this.setExtraAuthors(book.authors.slice(1));
		}

		this.setStatus('Dados encontrados em: ' + (book.source || 'base pública') + '. Confira e salve.', 'ok');
		this.input('quick_copies').focus().select();
	},

	// ------------------------------------------------- preenchimento com IA

	triggerAiPhoto: function() {
		if (this.searching || this.saving) {
			return;
		}
		var fileInput = this.getRoot().find('.quick_ai_file');
		fileInput.val('');
		fileInput.click();
	},

	onAiPhotoSelected: function(input) {
		var file = input.files && input.files[0];
		if (!file) {
			return;
		}

		this.searching = true;
		this.clearErrors();
		this.setStatus('Lendo a foto com IA...');

		this.resizeImage(file, 1280, function(base64, mimeType) {
			$.ajax({
				url: window.location.pathname,
				type: 'POST',
				dataType: 'json',
				data: {
					controller: 'json',
					module: 'cataloging.bibliographic',
					action: 'ai_extract',
					image_base64: base64,
					mime_type: mimeType
				},
				success: function(response) {
					QuickAdd.searching = false;
					if (response && response.success && response.data) {
						QuickAdd.applyBook(response.data);
					} else {
						QuickAdd.setStatus((response && response.message) || 'Não foi possível extrair os dados da foto.', 'warn');
					}
				},
				error: function() {
					QuickAdd.searching = false;
					QuickAdd.setStatus('Erro de comunicação ao analisar a foto com IA.', 'warn');
				}
			});
		}, function(errMsg) {
			QuickAdd.searching = false;
			QuickAdd.setStatus(errMsg || 'Não foi possível ler a imagem selecionada.', 'warn');
		});
	},

	resizeImage: function(file, maxDim, onDone, onError) {
		var reader = new FileReader();
		reader.onload = function(e) {
			var img = new Image();
			img.onload = function() {
				var w = img.width;
				var h = img.height;
				if (w > maxDim || h > maxDim) {
					if (w >= h) {
						h = Math.round(h * maxDim / w);
						w = maxDim;
					} else {
						w = Math.round(w * maxDim / h);
						h = maxDim;
					}
				}
				var canvas = document.createElement('canvas');
				canvas.width = w;
				canvas.height = h;
				var ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0, w, h);
				var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
				onDone(dataUrl.split(',')[1], 'image/jpeg');
			};
			img.onerror = function() {
				onError('Arquivo de imagem inválido.');
			};
			img.src = e.target.result;
		};
		reader.onerror = function() {
			onError('Falha ao ler o arquivo.');
		};
		reader.readAsDataURL(file);
	},

	// ------------------------------------------------- leitura pela câmera

	scanStream: null,
	scanTimer: null,

	scanSupported: function() {
		return ('BarcodeDetector' in window) && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
	},

	startScan: function() {
		if (!this.scanSupported() || this.scanStream) {
			return;
		}

		var box = this.getRoot().find('.quick_scan');
		var video = box.find('video').get(0);
		var detector;

		try {
			detector = new BarcodeDetector({ formats: ['ean_13'] });
		} catch (e) {
			this.setStatus('Este navegador não consegue ler código de barras. Digite o ISBN.', 'warn');
			return;
		}

		navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function(stream) {
			QuickAdd.scanStream = stream;
			video.srcObject = stream;
			video.play();
			box.show();
			QuickAdd.setStatus('Aponte a câmera para o código de barras da contracapa.');
			Core.fixResize();

			QuickAdd.scanTimer = setInterval(function() {
				if (video.readyState < 2) {
					return;
				}

				detector.detect(video).then(function(codes) {
					for (var i = 0; i < codes.length; i++) {
						var isbn = IsbnLookup.normalize(codes[i].rawValue);

						// Códigos de livro começam com 978 ou 979.
						if (isbn && /^97[89]/.test(isbn) && QuickAdd.scanStream) {
							QuickAdd.stopScan();
							QuickAdd.input('quick_isbn').val(isbn);
							QuickAdd.lookupIsbn();
							return;
						}
					}
				}, function() {
					// Quadro ilegível: tenta de novo no próximo.
				});
			}, 350);
		}, function() {
			QuickAdd.setStatus('Não foi possível usar a câmera. Autorize o acesso ou digite o ISBN.', 'warn');
		});
	},

	stopScan: function() {
		if (this.scanTimer) {
			clearInterval(this.scanTimer);
			this.scanTimer = null;
		}

		if (this.scanStream) {
			var tracks = this.scanStream.getTracks();

			for (var i = 0; i < tracks.length; i++) {
				tracks[i].stop();
			}

			this.scanStream = null;
		}

		this.getRoot().find('.quick_scan').hide();
	},

	// --------------------------------------------------------------- gravação

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

			// Demais autores entram como entradas secundárias de nome pessoal.
			for (var j = 0; j < this.extraAuthors.length; j++) {
				if (!json['700']) {
					json['700'] = [];
				}

				json['700'].push({ a: [this.extraAuthors[j]], ind1: '1' });
			}
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

		this.stopScan();
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
		this.input('quick_isbn').focus();

		CatalogingInput.updateDatabaseCount();
		CatalogingSearch.redoSearch();
	}
};

$(document).ready(function() {
	QuickAdd.init();
});
