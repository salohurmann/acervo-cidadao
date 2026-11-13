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
package biblivre.cataloging.bibliographic;

import biblivre.cataloging.CatalogingHandler;
import biblivre.cataloging.RecordDTO;
import biblivre.cataloging.enums.RecordType;
import biblivre.core.ExtendedRequest;
import biblivre.core.ExtendedResponse;
import biblivre.core.enums.ActionResult;
import biblivre.marc.MaterialType;
import org.json.JSONException;
import org.json.JSONObject;

public class Handler extends CatalogingHandler {

	public Handler() {
		super(RecordType.BIBLIO, MaterialType.BOOK);
	}
	
	@Override
	protected RecordDTO createRecordDTO(ExtendedRequest request) {
		return new BiblioRecordDTO();
	}

	public void aiExtract(ExtendedRequest request, ExtendedResponse response) {
		String imageBase64 = request.getString("image_base64");
		String mimeType = request.getString("mime_type", "image/jpeg");

		try {
			JSONObject book = BookAiExtractor.extractFromImage(imageBase64, mimeType);
			this.json.put("success", true);
			this.json.put("data", book);
		} catch (IllegalStateException e) {
			this.setMessage(ActionResult.WARNING, e.getMessage());
		} catch (Exception e) {
			this.setMessage(ActionResult.WARNING, "Não foi possível extrair os dados da foto: " + e.getMessage());
		}
	}
}
