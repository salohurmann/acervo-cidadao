<%@ page contentType="text/html" pageEncoding="UTF-8" %>
<%-- Redireciona para o endereço que o handler deixou em "redirect_url".
     Usado pelo login com Google (biblivre.login.Handler). --%>
<%
	String target = (String) request.getAttribute("redirect_url");

	if (target == null || target.trim().isEmpty()) {
		target = request.getContextPath() + "/";
	}

	response.setHeader("Cache-Control", "no-store");
	response.sendRedirect(target);
%>
