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
 * @author Alberto Wagner <alberto@biblivre.org.br>
 * @author Danniel Willian <danniel@biblivre.org.br>
 ******************************************************************************/
package biblivre.login;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import javax.servlet.http.HttpSession;

import org.apache.commons.lang3.StringUtils;
import org.joda.time.DateTime;
import org.joda.time.Days;
import org.json.JSONArray;
import org.json.JSONObject;

import biblivre.administration.backup.BackupBO;
import biblivre.administration.backup.BackupDTO;
import biblivre.administration.indexing.IndexingBO;
import biblivre.administration.usertype.UserTypeBO;
import biblivre.administration.usertype.UserTypeDTO;
import biblivre.circulation.user.UserBO;
import biblivre.circulation.user.UserDTO;
import biblivre.circulation.user.UserStatus;
import biblivre.core.AbstractHandler;
import biblivre.core.ExtendedRequest;
import biblivre.core.ExtendedResponse;
import biblivre.core.auth.AuthorizationBO;
import biblivre.core.auth.AuthorizationPointTypes;
import biblivre.core.auth.AuthorizationPoints;
import biblivre.core.enums.ActionResult;
import biblivre.core.utils.Constants;
import biblivre.core.utils.TextUtils;

public class Handler extends AbstractHandler {
	private final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(Handler.class);

	public void login(ExtendedRequest request, ExtendedResponse response) {
		String schema = request.getSchema();

		String username = request.getString("username");
		String password = request.getString("password");

		// Com o login pelo Google ativo, usuário e senha não são aceitos.
		if (GoogleLogin.isEnabled()) {
			this.message.setText(ActionResult.WARNING, "login.google.password_disabled");
			this.jspURL = "/jsp/index.jsp";
			return;
		}

		if (StringUtils.isBlank(username) || StringUtils.isBlank(password)) {
			this.message.setText(ActionResult.WARNING, "login.access_denied");
			this.jspURL = "/jsp/index.jsp";
			return;
		}

		LoginBO loginBo = LoginBO.getInstance(schema);
		LoginDTO user = loginBo.login(username, password);

		if (user != null) {
			AuthorizationBO authBo = AuthorizationBO.getInstance(schema);
			AuthorizationPoints atps = authBo.getUserAuthorizationPoints(user);

			_setAdmin(schema, user, atps);

			_performChecks(request, schema, password, user, atps);

			_populateSessionAttributes(request, schema, user, atps);

			this.message.setText(ActionResult.NORMAL, "login.welcome");
			this.jspURL = "/jsp/index.jsp";
			return; 
		} else {
			this.message.setText(ActionResult.WARNING, "login.access_denied");
			this.jspURL = "/jsp/index.jsp";
			return; 
		}
	}

	/**
	 * Início do login com conta Google: guarda um "state" aleatório na sessão
	 * e manda o navegador para a tela de contas do Google.
	 */
	public void googleStart(ExtendedRequest request, ExtendedResponse response) {
		String schema = request.getSchema();

		if (!GoogleLogin.isEnabled()) {
			this.message.setText(ActionResult.WARNING, "login.access_denied");
			this.jspURL = "/jsp/index.jsp";
			return;
		}

		String state = GoogleLogin.newState();
		request.setSessionAttribute(schema, "google_oauth_state", state);

		request.setAttribute("redirect_url", GoogleLogin.buildAuthorizationUrl(GoogleLogin.getCallbackUrl(request), state));
		this.jspURL = "/jsp/redirect.jsp";
	}

	/**
	 * Retorno do Google (endereço {base}sso/google-callback). Confere o
	 * "state", troca o código pelos dados da conta, exige o domínio aceito e
	 * abre a sessão. Sempre termina redirecionando para a página inicial; a
	 * mensagem ao usuário segue pela sessão.
	 */
	public void googleCallback(ExtendedRequest request, ExtendedResponse response) {
		String schema = request.getSchema();

		request.setAttribute("redirect_url", GoogleLogin.getBaseUrl(request));
		this.jspURL = "/jsp/redirect.jsp";

		String expectedState = (String) request.getSessionAttribute(schema, "google_oauth_state");
		request.getSession().removeAttribute(schema + ".google_oauth_state");

		String state = request.getString("state");
		String code = request.getString("code");

		if (!GoogleLogin.isEnabled() || StringUtils.isBlank(expectedState) || !expectedState.equals(state) || StringUtils.isBlank(code)) {
			_flash(request, ActionResult.WARNING, "login.google.error.failed");
			return;
		}

		try {
			GoogleLogin.Identity identity = GoogleLogin.exchangeCode(code, GoogleLogin.getCallbackUrl(request));

			LoginDTO user = _findOrCreateGoogleUser(schema, identity);
			user.setName(identity.getName());

			AuthorizationBO authBo = AuthorizationBO.getInstance(schema);
			AuthorizationPoints atps = authBo.getUserAuthorizationPoints(user);

			_setAdmin(schema, user, atps);

			if (GoogleLogin.isAdminEmail(identity.getEmail())) {
				atps.setAdmin(true);
			}

			// Sessão nova para quem acabou de se autenticar, preservando o idioma.
			Object language = request.getSessionAttribute(schema, "language");
			request.getSession().invalidate();

			if (language != null) {
				request.setSessionAttribute(schema, "language", language);
			}

			_performChecks(request, schema, "", user, atps);

			_populateSessionAttributes(request, schema, user, atps);

			_flash(request, ActionResult.NORMAL, "login.welcome");
		} catch (GoogleLogin.GoogleLoginException e) {
			this.logger.warn("Login com Google recusado: " + e.getDetail());
			_flash(request, ActionResult.WARNING, e.getMessage());
		} catch (Exception e) {
			this.logger.error("Falha no login com Google", e);
			_flash(request, ActionResult.WARNING, "login.google.error.failed");
		}
	}

	/**
	 * Login correspondente ao e-mail da conta Google. No primeiro acesso a
	 * pessoa é cadastrada como leitor; virar funcionário depende do
	 * administrador (Circulação > Cadastro de usuários e Administração >
	 * Permissões).
	 */
	private static LoginDTO _findOrCreateGoogleUser(String schema, GoogleLogin.Identity identity) throws GoogleLogin.GoogleLoginException {
		LoginBO loginBo = LoginBO.getInstance(schema);
		LoginDTO login = loginBo.get(identity.getEmail());

		if (login != null) {
			return login;
		}

		if (schema.equals(Constants.GLOBAL_SCHEMA)) {
			throw new GoogleLogin.GoogleLoginException("login.google.error.failed", "primeiro acesso fora de uma biblioteca");
		}

		List<UserTypeDTO> types = UserTypeBO.getInstance(schema).list();

		if (types == null || types.isEmpty()) {
			throw new GoogleLogin.GoogleLoginException("login.google.error.failed", "não há tipo de usuário cadastrado");
		}

		// O tipo de menor id é o "Leitor" da instalação padrão.
		int readerType = types.get(0).getId();

		for (UserTypeDTO type : types) {
			readerType = Math.min(readerType, type.getId());
		}

		UserDTO reader = new UserDTO();
		reader.setName(identity.getName());
		reader.setType(readerType);
		reader.setStatus(UserStatus.ACTIVE);
		reader.setCreatedBy(Constants.ADMIN_LOGGED_USER_ID);
		reader.addField("email", identity.getEmail());

		UserBO.getInstance(schema).save(reader);

		LoginDTO newLogin = new LoginDTO();
		newLogin.setLogin(identity.getEmail());
		newLogin.setEmployee(false);
		// Senha aleatória, que ninguém conhece: a entrada é só pelo Google.
		newLogin.setEncPassword(TextUtils.encodePassword(GoogleLogin.newState()));
		newLogin.setCreatedBy(Constants.ADMIN_LOGGED_USER_ID);

		loginBo.save(newLogin, reader);

		login = loginBo.get(identity.getEmail());

		if (login == null) {
			throw new GoogleLogin.GoogleLoginException("login.google.error.failed", "não foi possível cadastrar " + identity.getEmail());
		}

		return login;
	}

	// Mensagem exibida na próxima página (lida em jsp/taglib/layout/head/start.jsp).
	private static void _flash(ExtendedRequest request, ActionResult level, String messageKey) {
		request.setSessionAttribute("acervo.flash_message", request.getLocalizedText(messageKey));
		request.setSessionAttribute("acervo.flash_level", level.name().toLowerCase());
	}

	public void logout(ExtendedRequest request, ExtendedResponse response) {
		String schema = request.getSchema();
		String language = request.getLanguage();
		HttpSession session = request.getSession();

		@SuppressWarnings("unchecked")
		Enumeration<String> attributes = session.getAttributeNames();
		while (attributes.hasMoreElements()) {
			String attribute = attributes.nextElement();

			if (attribute != null && attribute.startsWith(schema + ".")) {
				session.removeAttribute(attribute);
			}
		}

		session.setAttribute(schema + ".language", language);

		this.message.setText(ActionResult.NORMAL, "login.goodbye");
		this.jspURL = "/jsp/index.jsp";
		return;
	}
	
	public void changePassword(ExtendedRequest request, ExtendedResponse response) {
		String schema = request.getSchema();
		int loggedId = request.getLoggedUserId();

		LoginBO lbo = LoginBO.getInstance(schema);

		String newPassword = request.getString("new_password");
		LoginDTO login = lbo.get(loggedId);
		login.setModifiedBy(loggedId);
		login.setEncPassword(TextUtils.encodePassword(newPassword));
		lbo.update(login);

		// O administrador é o login de id 1, qualquer que seja o nome de usuário.
		boolean warningPassword = newPassword.equals("abracadabra") && login.getId() == 1;
		request.setSessionAttribute(schema, "system_warning_password", warningPassword);

		this.message.setText(ActionResult.SUCCESS, "login.password.success");
		this.jspURL = "/jsp/administration/password.jsp";
		return;
	}

	private void _performChecks(
			ExtendedRequest request, String schema, String password, LoginDTO user,
			AuthorizationPoints atps) {

			if (atps.isAdmin()) {
				_checkDefaultPassword(request, schema, password);
			}

			if (!schema.equals(Constants.GLOBAL_SCHEMA)) {
				_checkLastBackup(request, schema, atps);

				_checkOutdatedIndexes(request, schema, atps);
			}
		}

		private void _populateSessionAttributes(
			ExtendedRequest request, String schema, LoginDTO user,
			AuthorizationPoints atps) {

			request.setSessionAttribute(schema, "logged_user", user);
			request.setSessionAttribute(schema, "logged_user_atps", atps);

			try {
				_populateMenus(request, atps);
			} catch (Exception e) {	//Should never happen
				this.setMessage(e);
			}
		}

		private void _setAdmin(
			String schema, LoginDTO user, AuthorizationPoints atps) {

			if ((user.getId() == 1) || schema.equals(Constants.GLOBAL_SCHEMA)) {
				atps.setAdmin(true);
			}
		}

		private void _checkDefaultPassword(
			ExtendedRequest request, String schema, String password) {

			boolean warningPassword = password.toLowerCase().equals("abracadabra");
			request.setSessionAttribute(schema, "system_warning_password", warningPassword);
		}

		private void _checkLastBackup(
			ExtendedRequest request, String schema, AuthorizationPoints atps) {

			if (atps.isAllowed(AuthorizationPointTypes.ADMINISTRATION_BACKUP)) {
				boolean warningBackup = false;

				BackupBO bbo = BackupBO.getInstance(schema);
				BackupDTO lastBackup = bbo.getLastBackup();

				if (lastBackup == null) {
					// bbo.simpleBackup();
					warningBackup = true;
				} else {
					int diff = Days.daysBetween(new DateTime(lastBackup.getCreated()), new DateTime()).getDays();
					warningBackup = (diff >= 3);
				}

				request.setSessionAttribute(schema, "system_warning_backup", warningBackup);
			}
		}

		private void _checkOutdatedIndexes(
			ExtendedRequest request, String schema, AuthorizationPoints atps) {

			if (atps.isAllowed(AuthorizationPointTypes.ADMINISTRATION_INDEXING)) {
				boolean warningReindex = IndexingBO.getInstance(schema).isIndexOutdated();
				request.setSessionAttribute(schema, "system_warning_reindex", warningReindex);
			}
		}

		private static void _populateMenus(
			ExtendedRequest request, AuthorizationPoints atps) throws Exception {

			JSONObject json = new JSONObject(_readMenusFile());

			Map<Integer, JSONObject> prioritizedMenus = _getPrioritizedMenus(json);

			Map<String, List<String>> allowedModules = new LinkedHashMap<>();

			prioritizedMenus.values().forEach(module -> {
				JSONArray items = module.getJSONArray("items");

				String name = module.getString("name");

				for (int i = 0; i < items.length(); i++) {
					String item = items.getString(i);

					if (atps.isAllowed("menu", item)) {
						allowedModules
							.computeIfAbsent(name, __ -> new ArrayList<>())
							.add(item);
					}
				}
			});

			request.setSessionAttribute("modules", allowedModules);
		}

		private static Map<Integer, JSONObject> _getPrioritizedMenus(
			JSONObject json) {

			JSONArray modules = json.getJSONArray("modules");

			Map<Integer, JSONObject> prioritizedMenus = new TreeMap<>();

			for (int i = 0; i < modules.length(); i++) {
				JSONObject module = modules.getJSONObject(i);

				int priority = module.getInt("priority");

				prioritizedMenus.put(priority, module);
			}

			return prioritizedMenus;
		}

		private static String _readMenusFile() throws IOException, URISyntaxException {
			return new String(
				Files.readAllBytes(
					Paths.get(
						Thread.currentThread().getContextClassLoader()
							.getResource("/META-INF/menus/menus.json")
							.toURI())));
		}
}
