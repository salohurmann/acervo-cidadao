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
 * públicas e gratuitas, sem chave de acesso. Só o número do ISBN é enviado.
 *
 * As bases são consultadas ao mesmo tempo e os resultados são combinados na
 * ordem de preferência abaixo, porque nenhuma delas é completa sozinha: a
 * CBL cobre quase todo livro brasileiro, mas costuma trazer só título (em
 * maiúsculas) e editora; a Open Library e o Mercado Editorial trazem autores,
 * ano e cidade; o Google Books sem chave tem cota diária compartilhada e
 * frequentemente recusa a consulta, por isso fica por último.
 */
var IsbnLookup = {
	timeout: 12000,

	sources: [
		{
			name: 'Mercado Editorial',
			portuguese: true,
			url: function(isbn) {
				return 'https://brasilapi.com.br/api/isbn/v1/' + isbn + '?providers=mercado-editorial';
			},
			parse: function(json) {
				return IsbnLookup.parseBrasilApi(json);
			}
		},
		{
			name: 'Open Library',
			url: function(isbn) {
				return 'https://brasilapi.com.br/api/isbn/v1/' + isbn + '?providers=open-library';
			},
			parse: function(json) {
				return IsbnLookup.parseBrasilApi(json);
			}
		},
		{
			name: 'Câmara Brasileira do Livro',
			portuguese: true,
			url: function(isbn) {
				return 'https://brasilapi.com.br/api/isbn/v1/' + isbn + '?providers=cbl';
			},
			parse: function(json) {
				return IsbnLookup.parseBrasilApi(json);
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
					subjects: info.categories
				};
			}
		}
	],

	parseBrasilApi: function(json) {
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
			subjects: json.subjects
		};
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

	isUpperCase: function(text) {
		return /[A-ZÀ-Ý]/.test(text) && text == text.toUpperCase();
	},

	// "AS ILUSOES ARMADAS" -> "As ilusoes armadas"
	sentenceCase: function(text) {
		return text.charAt(0).toUpperCase() + text.substring(1).toLowerCase();
	},

	// Deixa o resultado de uma base no formato usado pelo cadastro rápido.
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

		// "[São Paulo, Brasil]" -> "São Paulo"
		var place = text(text(book.place).replace(/[\[\]]/g, '').split(',')[0]);

		if (this.isUpperCase(place)) {
			place = place.toLowerCase().replace(/(^|\s)(\S)/g, function(m, space, letter) {
				return space + letter.toUpperCase();
			});
		}

		return {
			title: text(book.title),
			subtitle: text(book.subtitle),
			authors: authors,
			publisher: text(book.publisher),
			place: place,
			year: year ? year[0] : '',
			subject: list(book.subjects)[0] || ''
		};
	},

	// Combina os resultados na ordem de preferência das bases: cada campo
	// vem da primeira base que o tiver. results[i] corresponde a sources[i].
	merge: function(results) {
		var merged = { title: '', subtitle: '', authors: [], publisher: '', place: '', year: '', subject: '', source: '' };
		var used = [];
		var upperTitle = '';
		var upperSource = '';

		for (var i = 0; i < results.length; i++) {
			if (!results[i]) {
				continue;
			}

			var book = this.clean(results[i]);
			var contributed = false;

			if (!merged.title && book.title) {
				if (this.isUpperCase(book.title)) {
					// Título todo em maiúsculas só é usado se nenhuma base tiver melhor.
					if (!upperTitle) {
						upperTitle = book.title;
						upperSource = this.sources[i].name;
					}
				} else {
					merged.title = book.title;
					merged.subtitle = book.subtitle;
					contributed = true;
				}
			}

			if (merged.authors.length == 0 && book.authors.length > 0) {
				merged.authors = book.authors;
				contributed = true;
			}

			var names = ['publisher', 'place', 'year'];

			for (var j = 0; j < names.length; j++) {
				if (!merged[names[j]] && book[names[j]]) {
					merged[names[j]] = book[names[j]];
					contributed = true;
				}
			}

			// Assunto só de bases em português; as demais trazem termos em inglês.
			if (!merged.subject && book.subject && this.sources[i].portuguese) {
				merged.subject = book.subject;
				contributed = true;
			}

			if (contributed) {
				used.push(this.sources[i].name);
			}
		}

		if (!merged.title && upperTitle) {
			merged.title = this.sentenceCase(upperTitle);

			if ($.inArray(upperSource, used) == -1) {
				used.push(upperSource);
			}
		}

		if (!merged.title) {
			return null;
		}

		merged.source = used.join(', ');

		return merged;
	},

	// callback(book) quando encontra; callback(null, motivo) quando não.
	// motivo: 'not_found' (nenhuma base tem o ISBN) ou 'unavailable' (sem conexão).
	lookup: function(isbn, callback) {
		var self = this;
		var results = [];
		var pending = this.sources.length;
		var reachedAny = false;

		var request = function(index) {
			var source = self.sources[index];

			self.getJson(source.url(isbn), function(json, reached) {
				reachedAny = reachedAny || reached;

				try {
					results[index] = json ? source.parse(json) : null;
				} catch (e) {
					results[index] = null;
				}

				if (--pending == 0) {
					var book = self.merge(results);

					if (book) {
						callback(book);
					} else {
						callback(null, reachedAny ? 'not_found' : 'unavailable');
					}
				}
			});
		};

		for (var i = 0; i < this.sources.length; i++) {
			request(i);
		}
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
