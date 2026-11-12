package biblivre.update.seju_1_1_0;

import java.sql.Connection;
import java.sql.SQLException;

import biblivre.core.translations.Translations;
import biblivre.update.UpdateService;

/**
 * Versão SEJU: textos do login com conta Google.
 */
public class Update implements UpdateService {

	@Override
	public String getVersion() {
		return "seju-1.1.0";
	}

	@Override
	public void doUpdate(Connection connection) throws SQLException {
		// chave, pt-BR, en-US, es
		String[][] texts = {
			{
				"login.google.button",
				"Entrar com conta @seju.pr.gov.br",
				"Sign in with your @seju.pr.gov.br account",
				"Entrar con cuenta @seju.pr.gov.br"
			},
			{
				"login.google.password_disabled",
				"O acesso é feito somente com a conta Google institucional. Use o botão Entrar.",
				"Access is only available with the institutional Google account. Use the Sign in button.",
				"El acceso se realiza solamente con la cuenta Google institucional. Use el botón Entrar."
			},
			{
				"login.google.error.domain",
				"Esta conta não é do domínio institucional. Entre com sua conta @seju.pr.gov.br.",
				"This account does not belong to the institutional domain. Sign in with your @seju.pr.gov.br account.",
				"Esta cuenta no pertenece al dominio institucional. Entre con su cuenta @seju.pr.gov.br."
			},
			{
				"login.google.error.failed",
				"Não foi possível concluir o login com o Google. Tente novamente.",
				"The Google sign-in could not be completed. Please try again.",
				"No fue posible concluir el inicio de sesión con Google. Intente nuevamente."
			}
		};

		String[] languages = { "pt-BR", "en-US", "es" };

		for (String[] text : texts) {
			for (int i = 0; i < languages.length; i++) {
				Translations.addOrReplaceSingleTranslation(languages[i], text[0], text[i + 1]);
			}
		}
	}
}
