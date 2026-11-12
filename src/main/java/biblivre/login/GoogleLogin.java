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
package biblivre.login;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

import javax.servlet.http.HttpServletRequest;

import org.apache.commons.lang3.StringUtils;
import org.json.JSONObject;

/**
 * Login com conta Google (OpenID Connect, fluxo "authorization code"),
 * restrito a um domínio do Google Workspace.
 *
 * Fica ativo quando ACERVO_GOOGLE_CLIENT_ID e ACERVO_GOOGLE_CLIENT_SECRET
 * estão definidos (variável de ambiente ou propriedade de sistema de mesmo
 * nome). Com ele ativo, o login por usuário e senha é desligado.
 *
 * Configuração:
 *   ACERVO_GOOGLE_CLIENT_ID      ID do cliente OAuth (tipo "Aplicativo da Web")
 *   ACERVO_GOOGLE_CLIENT_SECRET  chave secreta do cliente
 *   ACERVO_GOOGLE_DOMAIN         domínio aceito (padrão: seju.pr.gov.br)
 *   ACERVO_ADMIN_EMAIL           e-mail que entra como administrador
 *   ACERVO_PUBLIC_URL            endereço público do sistema, ex.
 *                                https://acervo.exemplo.gov.br/acervo/
 *                                (se ausente, é deduzido da requisição)
 *
 * O URI de redirecionamento a cadastrar no Google é
 * {ACERVO_PUBLIC_URL}sso/google-callback.
 */
public final class GoogleLogin {
	public static final String CALLBACK_CONTROLLER = "google-callback";

	private static final String AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
	private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
	private static final String DEFAULT_DOMAIN = "seju.pr.gov.br";
	private static final String DEFAULT_ADMIN_EMAIL = "salomaohurmann@seju.pr.gov.br";
	private static final SecureRandom RANDOM = new SecureRandom();

	private GoogleLogin() {
	}

	/** Dados de quem entrou, já validados. */
	public static final class Identity {
		private final String email;
		private final String name;

		Identity(String email, String name) {
			this.email = email;
			this.name = name;
		}

		public String getEmail() {
			return this.email;
		}

		public String getName() {
			return this.name;
		}
	}

	/** Falha no login; getMessage() é a chave de tradução da mensagem ao usuário. */
	public static final class GoogleLoginException extends Exception {
		private static final long serialVersionUID = 1L;

		public GoogleLoginException(String messageKey, String detail) {
			super(messageKey);
			this.detail = detail;
		}

		private final String detail;

		public String getDetail() {
			return this.detail;
		}
	}

	private static String setting(String name) {
		String value = System.getProperty(name);

		if (StringUtils.isBlank(value)) {
			value = System.getenv(name);
		}

		return StringUtils.trimToEmpty(value);
	}

	public static boolean isEnabled() {
		return StringUtils.isNotBlank(GoogleLogin.getClientId()) && StringUtils.isNotBlank(setting("ACERVO_GOOGLE_CLIENT_SECRET"));
	}

	public static String getClientId() {
		return setting("ACERVO_GOOGLE_CLIENT_ID");
	}

	public static String getDomain() {
		return StringUtils.defaultIfBlank(setting("ACERVO_GOOGLE_DOMAIN"), DEFAULT_DOMAIN).toLowerCase();
	}

	public static String getAdminEmail() {
		return StringUtils.defaultIfBlank(setting("ACERVO_ADMIN_EMAIL"), DEFAULT_ADMIN_EMAIL).toLowerCase();
	}

	public static boolean isAdminEmail(String email) {
		return email != null && GoogleLogin.getAdminEmail().equals(email.toLowerCase());
	}

	// Só para testes automatizados: permite apontar a troca do código para um
	// servidor de simulação. Em produção deve ficar indefinida.
	private static String getTokenUrl() {
		return StringUtils.defaultIfBlank(setting("ACERVO_GOOGLE_TOKEN_URL"), TOKEN_URL);
	}

	/** Endereço público do sistema, sempre terminado em "/". */
	public static String getBaseUrl(HttpServletRequest request) {
		String base = setting("ACERVO_PUBLIC_URL");

		if (StringUtils.isBlank(base)) {
			// Atrás de um proxy que termina o HTTPS (Cloud Run, por exemplo) o
			// esquema original vem em X-Forwarded-Proto.
			String scheme = StringUtils.defaultIfBlank(request.getHeader("X-Forwarded-Proto"), request.getScheme());
			scheme = scheme.split(",")[0].trim();

			String host = StringUtils.defaultIfBlank(request.getHeader("Host"), request.getServerName());

			base = scheme + "://" + host + request.getContextPath();
		}

		return base.endsWith("/") ? base : base + "/";
	}

	public static String getCallbackUrl(HttpServletRequest request) {
		return GoogleLogin.getBaseUrl(request) + "sso/" + CALLBACK_CONTROLLER;
	}

	public static String newState() {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);

		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	public static String buildAuthorizationUrl(String callbackUrl, String state) {
		return AUTH_URL
			+ "?client_id=" + encode(GoogleLogin.getClientId())
			+ "&redirect_uri=" + encode(callbackUrl)
			+ "&response_type=code"
			+ "&scope=" + encode("openid email profile")
			+ "&state=" + encode(state)
			+ "&hd=" + encode(GoogleLogin.getDomain())
			+ "&prompt=select_account";
	}

	/**
	 * Troca o código devolvido pelo Google pelos dados de quem entrou e
	 * confere se a conta pertence ao domínio aceito.
	 */
	public static Identity exchangeCode(String code, String callbackUrl) throws GoogleLoginException {
		String body = "code=" + encode(code)
			+ "&client_id=" + encode(GoogleLogin.getClientId())
			+ "&client_secret=" + encode(setting("ACERVO_GOOGLE_CLIENT_SECRET"))
			+ "&redirect_uri=" + encode(callbackUrl)
			+ "&grant_type=authorization_code";

		String response;

		try {
			response = GoogleLogin.post(GoogleLogin.getTokenUrl(), body);
		} catch (IOException e) {
			throw new GoogleLoginException("login.google.error.failed", "falha ao contatar o Google: " + e.getMessage());
		}

		String idToken;

		try {
			idToken = new JSONObject(response).optString("id_token", "");
		} catch (Exception e) {
			throw new GoogleLoginException("login.google.error.failed", "resposta do Google não é JSON");
		}

		if (StringUtils.isBlank(idToken)) {
			throw new GoogleLoginException("login.google.error.failed", "o Google não devolveu id_token");
		}

		return GoogleLogin.validateIdToken(idToken, GoogleLogin.getClientId(), GoogleLogin.getDomain(), System.currentTimeMillis() / 1000L);
	}

	/**
	 * Confere os dados do id_token. A assinatura não é verificada porque o
	 * token é recebido diretamente do Google, por HTTPS, na troca do código
	 * (caso em que a documentação do Google dispensa a verificação); por
	 * isso este método nunca deve receber um token vindo do navegador.
	 */
	static Identity validateIdToken(String idToken, String clientId, String domain, long nowSeconds) throws GoogleLoginException {
		JSONObject claims;

		try {
			String[] parts = idToken.split("\\.");
			claims = new JSONObject(new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8));
		} catch (Exception e) {
			throw new GoogleLoginException("login.google.error.failed", "id_token ilegível");
		}

		String issuer = claims.optString("iss", "");

		if (!issuer.equals("https://accounts.google.com") && !issuer.equals("accounts.google.com")) {
			throw new GoogleLoginException("login.google.error.failed", "emissor inesperado: " + issuer);
		}

		if (StringUtils.isBlank(clientId) || !clientId.equals(claims.optString("aud", ""))) {
			throw new GoogleLoginException("login.google.error.failed", "id_token emitido para outro aplicativo");
		}

		// Tolerância de 60 s para diferença de relógio.
		if (claims.optLong("exp", 0L) + 60L < nowSeconds) {
			throw new GoogleLoginException("login.google.error.failed", "id_token expirado");
		}

		String email = claims.optString("email", "").trim().toLowerCase();

		if (StringUtils.isBlank(email) || !claims.optBoolean("email_verified", false)) {
			throw new GoogleLoginException("login.google.error.failed", "e-mail ausente ou não verificado");
		}

		// "hd" é o domínio do Google Workspace da conta; contas pessoais
		// (@gmail.com) não o têm. As duas condições são exigidas.
		String hostedDomain = claims.optString("hd", "").trim().toLowerCase();

		if (StringUtils.isBlank(domain) || !domain.equals(hostedDomain) || !email.endsWith("@" + domain)) {
			throw new GoogleLoginException("login.google.error.domain", "conta fora do domínio " + domain + ": " + email);
		}

		String name = StringUtils.defaultIfBlank(claims.optString("name", "").trim(), email);

		return new Identity(email, name);
	}

	private static String encode(String value) {
		try {
			return URLEncoder.encode(value, "UTF-8");
		} catch (java.io.UnsupportedEncodingException e) {
			throw new IllegalStateException(e);
		}
	}

	private static String post(String url, String body) throws IOException {
		HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();

		try {
			con.setRequestMethod("POST");
			con.setConnectTimeout(10000);
			con.setReadTimeout(10000);
			con.setDoOutput(true);
			con.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
			con.setRequestProperty("Accept", "application/json");

			try (OutputStream out = con.getOutputStream()) {
				out.write(body.getBytes(StandardCharsets.UTF_8));
			}

			int status = con.getResponseCode();
			InputStream in = (status >= 200 && status < 300) ? con.getInputStream() : con.getErrorStream();
			String response = in == null ? "" : GoogleLogin.readAll(in);

			if (status < 200 || status >= 300) {
				throw new IOException("HTTP " + status + " " + StringUtils.abbreviate(response, 300));
			}

			return response;
		} finally {
			con.disconnect();
		}
	}

	private static String readAll(InputStream in) throws IOException {
		try (InputStream input = in) {
			ByteArrayOutputStream out = new ByteArrayOutputStream();
			byte[] buffer = new byte[4096];
			int read;

			while ((read = input.read(buffer)) != -1) {
				out.write(buffer, 0, read);
			}

			return new String(out.toByteArray(), StandardCharsets.UTF_8);
		}
	}
}
