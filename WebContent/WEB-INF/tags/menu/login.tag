<%@ tag language="java" pageEncoding="UTF-8"%>
<%@ tag import="biblivre.login.GoogleLogin" %>
<%@ taglib prefix="c" uri="http://java.sun.com/jsp/jstl/core" %>
<%@ taglib prefix="i18n" uri="/WEB-INF/tlds/translations.tld" %>
<%@ taglib prefix="menu" tagdir="/WEB-INF/tags/menu" %>

<% jspContext.setAttribute("googleLoginEnabled", Boolean.valueOf(GoogleLogin.isEnabled())); %>

<c:choose>
	<c:when test="${googleLoginEnabled}">
		<%-- Login só com conta Google do domínio aceito (biblivre.login.GoogleLogin). --%>
		<li data-module="login" class="login google_login">
			<a href="?controller=jsp&amp;module=login&amp;action=google_start"><i18n:text key="login.google.button" /></a>
		</li>
	</c:when>
	<c:otherwise>
		<li data-module="login" class="login">
			<button onclick="Core.submitForm('login', 'login', 'jsp');">
				<i18n:text key="label.login" />
			</button>
		</li>
		<li class="inputs">&#160;
			<input type="text" name="username" placeholder="<i18n:text key='label.username' />" />
			<input type="password" name="password" placeholder="<i18n:text key='label.password' />" />
		</li>
	</c:otherwise>
</c:choose>
