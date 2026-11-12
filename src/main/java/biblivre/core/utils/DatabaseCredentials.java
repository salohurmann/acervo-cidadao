/*******************************************************************************
 * Este arquivo é parte do Biblivre5.
 * 
 * Biblivre5 é um software livre; você pode redistribuí-lo e/ou 
 * modificá-lo dentro dos termos da Licença Pública Geral GNU como 
 * publicada pela Fundação do Software Livre (FSF); na versão 3 da 
 * Licença, ou (caso queira) qualquer versão posterior.
 * 
 * Este programa é distribuído na esperança de que possa ser  útil, 
 * mas SEM NENHUMA GARANTIA; nem mesmo a garantia implícita de
 * MERCANTIBILIDADE OU ADEQUAÇÃO PARA UM FIM PARTICULAR. Veja a
 * Licença Pública Geral GNU para maiores detalhes.
 * 
 * Você deve ter recebido uma cópia da Licença Pública Geral GNU junto
 * com este programa, Se não, veja em <http://www.gnu.org/licenses/>.
 * 
 * Arquivo adicionado na versão SEJU (UTEC/SEJU-PR), novembro de 2026.
 ******************************************************************************/
package biblivre.core.utils;

import org.apache.commons.lang3.StringUtils;

/**
 * Senha do usuário "biblivre" do PostgreSQL usada pelos utilitários externos
 * (pg_dump e psql) em backup, restauração e criação de bibliotecas.
 *
 * A senha é lida, nesta ordem, da propriedade de sistema
 * <code>biblivre.db.password</code>, da variável de ambiente
 * <code>BIBLIVRE_DB_PASSWORD</code> e, por último, do valor padrão do
 * Biblivre. Ela deve ser a mesma configurada em META-INF/context.xml.
 */
public final class DatabaseCredentials {
	public static final String PASSWORD_PROPERTY = "biblivre.db.password";
	public static final String PASSWORD_ENV = "BIBLIVRE_DB_PASSWORD";

	private static final String DEFAULT_PASSWORD = "abracadabra";

	private DatabaseCredentials() {
	}

	public static String getPassword() {
		String password = System.getProperty(PASSWORD_PROPERTY);

		if (StringUtils.isBlank(password)) {
			password = System.getenv(PASSWORD_ENV);
		}

		return StringUtils.isBlank(password) ? DEFAULT_PASSWORD : password;
	}

	public static boolean isDefaultPassword() {
		return DEFAULT_PASSWORD.equals(DatabaseCredentials.getPassword());
	}
}
