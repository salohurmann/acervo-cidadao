<%@ page language="java" contentType="text/html; charset=UTF-8"
	pageEncoding="UTF-8"%>
<%@ page import="java.util.Set"%>
<%@ page import="biblivre.core.translations.Languages"%>
<%@ page import="biblivre.core.translations.TranslationsMap"%>
<%@ page import="biblivre.core.translations.LanguageDTO"%>
<%@ page import="biblivre.core.configurations.Configurations"%>
<%@ page import="biblivre.core.utils.Constants"%>
<%@ page import="org.apache.commons.lang3.StringUtils"%>

<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="menu" tagdir="/WEB-INF/tags/menu" %>
<%@ taglib prefix="i18n" uri="/WEB-INF/tlds/translations.tld" %>

<jsp:useBean id="schema" type="java.lang.String" scope="request" />
<jsp:useBean id="translationsMap" type="biblivre.core.translations.TranslationsMap" scope="request" />
<jsp:useBean id="isMultiPart" type="java.lang.Boolean" scope="request" />
<jsp:useBean id="isDisableMenu" type="java.lang.Boolean" scope="request" />
<jsp:useBean id="isBanner" type="java.lang.Boolean" scope="request" />
<jsp:useBean id="isSchemaSelection" type="java.lang.Boolean" scope="request" />
<jsp:useBean id="isEmployee" type="java.lang.Boolean" scope="request" />
<jsp:useBean id="isLogged" type="java.lang.Boolean" scope="request" />



<script type='text/javascript'>//Recarrega página para atualizar o atributo ${name}

(function()
{
  if( window.localStorage )
  {
    if( !localStorage.getItem('firstLoad') )
    {
      localStorage['firstLoad'] = true;
      window.location.reload();
    }  
    else
      localStorage.removeItem('firstLoad');
  }
})();

</script>


<c:set var="multiPartAttributes">
	enctype="multipart/form-data" accept-charset="UTF-8"
</c:set>
<c:set var="notMultiPartAttribute">
	onsubmit="return false;"
</c:set>

<%-- Marca oficial: basta copiar o arquivo fornecido pela Comunicação para
     static/images/marca_seju.png. Enquanto ele não existir, o cabeçalho usa a
     assinatura em texto. --%>
<%
	pageContext.setAttribute("hasOfficialBrand",
		Boolean.valueOf(application.getResource("/static/images/marca_seju.png") != null));
%>

<body>
	<form id="page_submit" name="page_submit" method="post" ${isMultiPart ? pageScope.multiPartAttributes : pageScope.notMultiPartAttribute}>
		<input type="hidden" name="controller" id="controller" value='${isMultiPart ? "json" : "jsp"}'>
		<input type="hidden" name="module" id="module" value="login">
		<input type="hidden" name="action" id="action" value='${isLogged ? "logout" : "login"}'>

		<div id="header">
			<div id="logo_biblivre" class="marca_seju">
				<a href="https://www.justica.pr.gov.br/" target="_blank" rel="noopener" title="Secretaria da Justiça e Cidadania - Governo do Estado do Paraná">
					<c:choose>
						<c:when test="${hasOfficialBrand}">
							<img src="static/images/marca_seju.png" alt="Secretaria da Justiça e Cidadania - Governo do Estado do Paraná">
						</c:when>
						<c:otherwise>
							<span class="marca_estado">PARANÁ</span>
							<span class="marca_governo">Governo do Estado</span>
							<span class="marca_orgao">Justiça e Cidadania</span>
						</c:otherwise>
					</c:choose>
				</a>
			</div>

			<%-- Âncoras usadas por Core.fixResize (biblivre.core.js). Os logotipos de
			     apoiadores do projeto Biblivre estão creditados em Ajuda > Sobre. --%>
			<div id="logo_support"></div>
			<div id="logo_sponsor">
				<div id="clock"></div>
			</div>

			<div id="title">
				<h1><a href="?"><%= Configurations.getString(schema, Constants.CONFIG_TITLE) %></a></h1>
				<h2><%= Configurations.getHtml(schema, Constants.CONFIG_SUBTITLE) %></h2>
			</div>
			
			<c:if test="${languages.size() > 1}">
				<div id="language_selection">
					<select class="combo combo_auto_size" name="i18n" onchange="Core.submitForm('menu', 'i18n', 'jsp');">
						<c:forEach items="${languages}" var="dto">
							<c:set var="selectedAttr">
								${translationsMap.getLanguage().equals(dto.getLanguage()) ? "selected" : ""}
							</c:set>
							<option value="${dto.getLanguage()}" ${selectedAttr}>${dto.toString()}</option>
						</c:forEach>
					</select>
				</div>
			</c:if>
			<div id="menu">
				<ul>
					<c:choose>
						<c:when test="${isDisableMenu}">
							<menu:help />
						</c:when>
						<c:when test="${isSchemaSelection}">
							<c:choose>
								<c:when  test="${isLogged}">
									<menu:level module="multi_schema">
										<menu:item module="multi_schema" action="administration_password"  />
										<menu:item module="multi_schema" action="multi_schema_manage"  />
										<menu:item module="multi_schema" action="multi_schema_configurations"  />
										<menu:item module="multi_schema" action="multi_schema_translations"  />
										<menu:item module="multi_schema" action="multi_schema_backup"  />
									</menu:level>
									<menu:help />
									<li class="logged_user_name" style="padding-left: 450px;"><%--Login multibiblioteca--%>
									  <c:out value="${name}"></c:out>
									</li>
									<menu:logout />
								</c:when>
								<c:otherwise>
									<menu:help />
									<menu:login />
								</c:otherwise>
							</c:choose>
						</c:when>
						<c:otherwise>
							<c:choose>
								<c:when test="${isEmployee or isLogged}">
									<c:forEach var="entry" items="${sessionScope.modules}"> <%-- Map<String, List<String>> --%>
										<menu:level module="${entry.key}">
											<c:forEach var="action" items="${entry.value}">
												<menu:item module="${entry.key}" action="${action}"/>
											</c:forEach>
										</menu:level>
									</c:forEach>
									<menu:help />
									<li class="logged_user_name" style="padding-left:40px;"><%--Login single --%>
									  <c:out value="${name}"></c:out>
									</li>
									<menu:logout />	
								</c:when>
								<c:otherwise>
									<menu:level module="search">
										<menu:item module="search" action="search_bibliographic"  />
										<menu:item module="search" action="search_authorities"  />
										<menu:item module="search" action="search_vocabulary"  />
										<menu:item module="search" action="search_z3950"  />
									</menu:level>
									<menu:help />
									<menu:login />
								</c:otherwise>
							</c:choose>
						</c:otherwise>
					</c:choose>
				</ul>

				<div id=slider_area>
					<div id=slider ></div>
				</div>
			</div>
		</div>

		<div id=notifications>
			<div id=messages>

		<c:if test="${isLogged && !isDisableMenu}">
			<c:set var="passwordWarning" value='${schema}.system_warning_password' />
			<c:set var="backupWarning" value='${schema}.system_warning_backup' />
			<c:set var="indexingWarning" value='${schema}.system_warning_reindex' />
			<c:set var="updateWarning" value='${schema}.system_warning_new_version' />

			<c:if test='${sessionScope[passwordWarning]}'>
				<div class="message sticky error system_warning_password">
					<div>
						<i18n:text key="warning.change_password" escapeHTML="true" />
						<a href="?action=administration_password" class="fright">
							<i18n:text key="warning.fix_now" escapeHTML="true"/>
						</a>
					</div>
				</div>
			</c:if>
			<c:if test="${sessionScope[backupWarning]}">
				<div class="message sticky error system_warning_backup">
					<div>
						<i18n:text key="warning.create_backup" escapeHTML="true" />
						<a href="?action=administration_maintenance" class="fright">
							<i18n:text key="warning.fix_now" escapeHTML="true"/>
						</a>
					</div>
				</div>
			</c:if>

			<c:if test="${sessionScope[indexingWarning]}">
				<div class="message sticky error system_warning_reindex">
					<div>
						<i18n:text key="warning.reindex_database" escapeHTML="true" />
							<a href="?action=administration_maintenance" class="fright">
								<i18n:text key="warning.fix_now" escapeHTML="true"/>
							</a>
					</div>
				</div>
			</c:if>

			<c:if test="${sessionScope[updateWarning]}">
				<div class="message sticky error system_warning_new_version">
					<div>
						<div class="fright">
							<a href="javascript:void(0)" onclick="Core.ignoreUpdate(this);" class="close" target="_blank">&times;</a>
							<br>
							<a href="<c:out value='<%= Constants.DOWNLOAD_URL %>' />" target="_blank">
								<i18n:text key="warning.download_site" escapeHTML="true" />
							</a>
						</div>
						<c:out value='${message}' escapeXml="false" />
					</div>
				</div>
			</c:if>
		</c:if>
		</div>
		<div id="breadcrumb">
			<div id="page_help_icon">
				<a onclick="PageHelp.show();"
					title='<i18n:text key="common.help" escapeHTML="true" />'>?</a>
			</div>
		</div>
	</div>

	<div id="content_outer">
		<c:if test="${isBanner}">
			<div class="banner"></div>
		</c:if>
		<div id="content">
			<div class="px"></div>
				<div id="content_inner">
					<noscript>
						<i18n:text key="text.main.noscript" escapeHTML="true" />
						<ul>
							<li>
								<a href="?action=list_bibliographic">Bibliográfica</a>
							</li>
							<%-- TODO: SEO -->
							<%-- <li><a href=\"?action=list_authorities\">Autoridades</a></li> --%>
							<%-- <li><a href=\"?action=list_vocabulary\">Vocabulário</a></li> --%>
						</ul>
					</noscript>