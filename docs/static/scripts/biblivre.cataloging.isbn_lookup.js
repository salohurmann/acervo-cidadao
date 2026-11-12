/**
 * Este arquivo é parte do Biblivre5 (versão SEJU - Acervo Cidadão).
 *
 * Biblivre5 é um software livre; você pode redistribuí-lo e/ou
 * modificá-lo dentro dos termos da Licença Pública Geral GNU como
 * publicada pela Fundação do Software Livre (FSF); na versão 3 da
 * Licença, ou (caso queira) qualquer versão posterior.
 *
 * Consulta de dados de um livro pelo ISBN.
 *
 * A consulta é feita pelo navegador de quem está cadastrando, em bases
 * públicas e gratuitas, sem chave de acesso: primeiro a BrasilAPI (que reúne
 * CBL, Mercado Editorial, Open Library e Google Books) e, se ela não achar,
 * o Google Books diretamente. Só o número do ISBN é enviado.
 */
var IsbnLookup = {
	timeout: 12000,

	sources: [
		{
			name: 'BrasilAPI',
			url: function(isbn) {
				return 'https://brasilapi.com.br/api/isbn/v1/' + isbn;
			},
			parse: function(json) {
				if (!json || !json.title) {
					return null;
				}

				return {
					title: json.title,
					subtitle: json.subtitle,
					authors: json.authors,
					publisher: json.publisher,
					place: json.location,
					year: json.year,
					subjects: json.subjects,
					source: IsbnLookup.providerName(json.provider)
				};
			}
		},
		{
			name: 'Google Books',
			url: function(isbn) {
				return 'https://www.googleapis.com/books/v1/volumes?maxResults=1&q=isbn:' + isbn;
			},
			parse: function(json) {
				var info = json && json.items && json.items[0] && json.items[0].volumeInfo;

				if (!info || !info.title) {
					return null;
				}

				return {
					title: info.title,
					subtitle: info.subtitle,
					authors: info.authors,
					publisher: info.publisher,
					year: info.publishedDate,
					subjects: info.categories,
					source: 'Google Books'
				};
			}
		}
	],

	providerName: function(provider) {
		var names = {
			'cbl': 'Câmara Brasileira do Livro',
			'mercado-editorial': 'Mercado Editorial',
			'open-library': 'Open Library',
			'google-books': 'Google Books'
		};

		return names[provider] || 'BrasilAPI';
	},

	// Devolve o ISBN só com dígitos (e X final no ISBN-10), ou '' se inválido.
	normalize: function(text) {
		var isbn = String(text || '').toUpperCase().replace(/[^0-9X]/g, '');

		if (isbn.length == 13 && /^\d{13}$/.test(isbn)) {
			return this.check13(isbn) ? isbn : '';
		}

		if (isbn.length == 10 && /^\d{9}[\dX]$/.test(isbn)) {
			return this.check10(isbn) ? this.to13(isbn) : '';
		}

		return '';
	},

	check13: function(isbn) {
		var sum = 0;

		for (var i = 0; i < 12; i++) {
			sum += parseInt(isbn.charAt(i), 10) * (i % 2 == 0 ? 1 : 3);
		}

		return (10 - (sum % 10)) % 10 == parseInt(isbn.charAt(12), 10);
	},

	check10: function(isbn) {
		var sum = 0;

		for (var i = 0; i < 10; i++) {
			var c = isbn.charAt(i);
			sum += (c == 'X' ? 10 : parseInt(c, 10)) * (10 - i);
		}

		return sum % 11 == 0;
	},

	to13: function(isbn10) {
		var base = '978' + isbn10.substring(0, 9);
		var sum = 0;

		for (var i = 0; i < 12; i++) {
			sum += parseInt(base.charAt(i), 10) * (i % 2 == 0 ? 1 : 3);
		}

		return base + ((10 - (sum % 10)) % 10);
	},

	// "Machado de Assis" -> "Assis, Machado de" (entrada pelo sobrenome).
	invertName: function(name) {
		name = $.trim(String(name || '').replace(/\s+/g, ' '));

		if (!name || name.indexOf(',') != -1) {
			return name;
		}

		var parts = name.split(' ');

		if (parts.length < 2) {
			return name;
		}

		var surname = [parts.pop()];

		// "Silva Filho", "Souza Júnior", "Lima Neto": o parentesco acompanha o sobrenome.
		if (/^(filho|filha|j[uú]nior|jr\.?|neto|neta|sobrinho|sobrinha)$/i.test(surname[0]) && parts.length > 1) {
			surname.unshift(parts.pop());
		}

		return surname.join(' ') + ', ' + parts.join(' ');
	},

	// Deixa o resultado no formato usado pelo cadastro rápido.
	clean: function(book) {
		var text = function(value) {
			return $.trim(String(value == null ? '' : value).replace(/\s+/g, ' '));
		};

		var list = function(value) {
			var out = [];

			if (value && value.length && typeof value != 'string') {
				for (var i = 0; i < value.length; i++) {
					if (text(value[i])) {
						out.push(text(value[i]));
					}
				}
			} else if (text(value)) {
				out.push(text(value));
			}

			return out;
		};

		var authors = list(book.authors);

		for (var i = 0; i < authors.length; i++) {
			authors[i] = this.invertName(authors[i]);
		}

		var year = text(book.year).match(/\d{4}/);

		return {
			title: text(book.title),
			subtitle: text(book.subtitle),
			authors: authors,
			publisher: text(book.publisher),
			place: text(book.place),
			year: year ? year[0] : '',
			subject: list(book.subjects)[0] || '',
			source: text(book.source)
		};
	},

	// callback(book) quando encontra; callback(null, motivo) quando não.
	// motivo: 'not_found' (nenhuma base tem o ISBN) ou 'unavailable' (sem conexão).
	lookup: function(isbn, callback) {
		var index = 0;
		var reachedAny = false;
		var self = this;

		var next = function() {
			if (index >= self.sources.length) {
				callback(null, reachedAny ? 'not_found' : 'unavailable');
				return;
			}

			var source = self.sources[index++];

			self.getJson(source.url(isbn), function(json, reached) {
				reachedAny = reachedAny || reached;

				var book = null;

				try {
					book = json ? source.parse(json) : null;
				} catch (e) {
					book = null;
				}

				if (book) {
					callback(self.clean(book));
				} else {
					next();
				}
			});
		};

		next();
	},

	// done(json, reached): json nulo em erro; reached indica se o servidor respondeu.
	getJson: function(url, done) {
		var finished = false;
		var xhr = new XMLHttpRequest();

		var finish = function(json, reached) {
			if (!finished) {
				finished = true;
				done(json, reached);
			}
		};

		xhr.onreadystatechange = function() {
			if (xhr.readyState != 4) {
				return;
			}

			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					finish(JSON.parse(xhr.responseText), true);
				} catch (e) {
					finish(null, true);
				}
			} else {
				// status 0 = rede, bloqueio ou tempo esgotado; 404 = ISBN desconhecido.
				finish(null, xhr.status != 0);
			}
		};

		try {
			xhr.open('GET', url, true);
			xhr.timeout = this.timeout;
			xhr.ontimeout = function() {
				finish(null, false);
			};
			xhr.send();
		} catch (e) {
			finish(null, false);
		}
	}
};
