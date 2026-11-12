package biblivre.update.seju_1_0_0;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;

import biblivre.core.translations.Translations;
import biblivre.update.UpdateService;

/**
 * Versão SEJU: substitui os textos da página inicial em português, que
 * citavam o "Biblivre versão 4.0", pelos textos do Acervo Cidadão.
 * Os textos continuam editáveis em Administração > Traduções.
 */
public class Update implements UpdateService {

	@Override
	public String getVersion() {
		return "seju-1.0.0";
	}

	@Override
	public void doUpdate(Connection connection) throws SQLException {
		for (Map.Entry<String, String> entry : _TRANSLATIONS.entrySet()) {
			Translations.addOrReplaceSingleTranslation("pt-BR", entry.getKey(), entry.getValue());
		}
	}

	private static final Map<String, String> _TRANSLATIONS = new LinkedHashMap<String, String>();

	static {
		_TRANSLATIONS.put("text.main.logged_out",
			"<p>Bem-vindo ao <strong>Acervo Cidadão</strong>, o sistema de bibliotecas da Secretaria da Justiça e Cidadania do Estado do Paraná.</p>"
			+ "<p>Use a opção <em>\"Pesquisa\"</em>, no menu superior, para consultar o acervo. A consulta é livre e não exige usuário e senha.</p>"
			+ "<p>Para reservar obras ou acompanhar seus empréstimos, informe seu usuário e senha no canto superior direito.</p>");

		_TRANSLATIONS.put("text.main.logged_in",
			"<p>Olá {0},</p>"
			+ "<p>Seja bem-vindo ao <strong>Acervo Cidadão</strong>.</p>"
			+ "<p>Em <em>\"Pesquisa\"</em> você consulta registros bibliográficos, autoridades e vocabulário, da mesma forma que os leitores.</p>"
			+ "<p>Em <em>\"Circulação\"</em> ficam o cadastro de leitores, empréstimos, devoluções, reservas, controle de acesso e carteirinhas.</p>"
			+ "<p>Em <em>\"Catalogação\"</em> você mantém o acervo: obras, exemplares, autoridades, vocabulário, etiquetas, importação e exportação de registros e arquivos digitais.</p>"
			+ "<p>Em <em>\"Aquisição\"</em> é possível acompanhar a compra e o recebimento de publicações.</p>"
			+ "<p>Em <em>\"Administração\"</em> estão a troca de senha, permissões, relatórios, configurações, traduções e a manutenção da base de dados, incluindo a cópia de segurança (backup) e a reindexação.</p>"
			+ "<p>Dúvidas sobre o sistema: procure a Unidade de Tecnologia (UTEC) ou consulte o manual em <em>\"Ajuda\"</em>.</p>");
	}
}
