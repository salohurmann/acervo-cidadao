package biblivre.cataloging.bibliographic;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import org.apache.commons.lang3.StringUtils;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Extrai metadados bibliográficos a partir da foto da capa, folha de rosto ou
 * ficha catalográfica usando a API Gemini (variável ACERVO_GEMINI_API_KEY).
 */
public final class BookAiExtractor {

	private static final String GEMINI_ENDPOINT =
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

	private static final String PROMPT =
		"Analise esta imagem de um livro (capa, folha de rosto, contracapa ou ficha catalográfica). "
		+ "Extraia apenas os dados visíveis ou claramente identificáveis do livro em JSON válido, "
		+ "usando exatamente estas chaves:\n"
		+ "- title: título principal do livro (string)\n"
		+ "- subtitle: subtítulo, se houver (string)\n"
		+ "- authors: lista de autores no formato \"Sobrenome, Nome\" (array de strings)\n"
		+ "- edition: edição, ex. \"2. ed.\" (string)\n"
		+ "- publisher: editora (string)\n"
		+ "- place: cidade de publicação (string)\n"
		+ "- year: ano de publicação com 4 dígitos (string)\n"
		+ "- isbn: apenas os dígitos do ISBN-10 ou ISBN-13, se visível (string)\n"
		+ "- subject: assunto principal curto em português (string)\n"
		+ "Se algum campo não estiver visível, retorne string vazia \"\" (ou [] para authors).";

	private BookAiExtractor() {
	}

	public static String getApiKey() {
		String key = System.getenv("ACERVO_GEMINI_API_KEY");
		if (StringUtils.isBlank(key)) {
			key = System.getenv("GEMINI_API_KEY");
		}
		return StringUtils.trimToEmpty(key);
	}

	public static JSONObject extractFromImage(String base64Data, String mimeType) throws IOException {
		String apiKey = getApiKey();
		if (StringUtils.isBlank(apiKey)) {
			throw new IllegalStateException("Chave ACERVO_GEMINI_API_KEY não configurada no servidor.");
		}

		if (StringUtils.isBlank(base64Data)) {
			throw new IllegalArgumentException("Nenhuma imagem foi enviada.");
		}

		String safeMime = StringUtils.defaultIfBlank(mimeType, "image/jpeg");
		if (!safeMime.startsWith("image/")) {
			safeMime = "image/jpeg";
		}

		JSONObject inlineData = new JSONObject();
		inlineData.put("mime_type", safeMime);
		inlineData.put("data", base64Data);

		JSONObject textPart = new JSONObject();
		textPart.put("text", PROMPT);

		JSONObject imagePart = new JSONObject();
		imagePart.put("inline_data", inlineData);

		JSONArray parts = new JSONArray();
		parts.put(textPart);
		parts.put(imagePart);

		JSONObject content = new JSONObject();
		content.put("parts", parts);

		JSONArray contents = new JSONArray();
		contents.put(content);

		JSONObject generationConfig = new JSONObject();
		generationConfig.put("responseMimeType", "application/json");
		generationConfig.put("temperature", 0.1);

		JSONObject payload = new JSONObject();
		payload.put("contents", contents);
		payload.put("generationConfig", generationConfig);

		HttpURLConnection conn = (HttpURLConnection) new URL(GEMINI_ENDPOINT + apiKey).openConnection();
		conn.setRequestMethod("POST");
		conn.setConnectTimeout(10000);
		conn.setReadTimeout(35000);
		conn.setDoOutput(true);
		conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

		byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
		try (OutputStream os = conn.getOutputStream()) {
			os.write(body);
		}

		int status = conn.getResponseCode();
		InputStream is = (status >= 200 && status < 300) ? conn.getInputStream() : conn.getErrorStream();
		String rawResponse = readAll(is);

		if (status < 200 || status >= 300) {
			throw new IOException("Gemini API retornou HTTP " + status + ": " + StringUtils.left(rawResponse, 300));
		}

		JSONObject root = new JSONObject(rawResponse);
		JSONArray candidates = root.optJSONArray("candidates");
		if (candidates == null || candidates.length() == 0) {
			throw new IOException("A IA não retornou dados para esta imagem.");
		}

		JSONObject first = candidates.getJSONObject(0);
		JSONObject firstContent = first.getJSONObject("content");
		JSONArray respParts = firstContent.getJSONArray("parts");
		String text = respParts.getJSONObject(0).getString("text").trim();

		if (text.startsWith("```")) {
			text = text.replaceAll("^```[a-zA-Z]*\\s*", "").replaceAll("\\s*```$", "").trim();
		}

		JSONObject extracted = new JSONObject(text);
		extracted.put("source", "IA (foto)");
		return extracted;
	}

	private static String readAll(InputStream is) throws IOException {
		if (is == null) {
			return "";
		}
		StringBuilder sb = new StringBuilder();
		try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
			String line;
			while ((line = br.readLine()) != null) {
				sb.append(line).append('\n');
			}
		}
		return sb.toString();
	}
}
