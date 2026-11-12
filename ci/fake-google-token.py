#!/usr/bin/env python3
"""Simulação do endpoint de token do Google, só para o teste de fumaça.

Devolve um id_token (sem assinatura válida) cujos dados dependem do "code"
recebido: admin, leitor, gmail ou outro-dominio. A aplicação só fala com
este servidor quando ACERVO_GOOGLE_TOKEN_URL aponta para ele.
"""
import base64
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs

ACCOUNTS = {
    "admin": {"email": "salomaohurmann@seju.pr.gov.br", "hd": "seju.pr.gov.br", "name": "Administrador de Teste"},
    "leitor": {"email": "novo.leitor@seju.pr.gov.br", "hd": "seju.pr.gov.br", "name": "Novo Leitor de Teste"},
    "gmail": {"email": "pessoa@gmail.com", "name": "Conta Pessoal"},
    "outro-dominio": {"email": "pessoa@outra.gov.br", "hd": "outra.gov.br", "name": "Outro Orgao"},
}


def b64(data):
    return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        form = parse_qs(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode())
        account = ACCOUNTS.get(form.get("code", [""])[0])

        if account is None or form.get("client_secret", [""])[0] != "segredo-de-teste":
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"error":"invalid_grant"}')
            return

        claims = dict(account)
        claims.update({
            "iss": "https://accounts.google.com",
            "aud": form.get("client_id", [""])[0],
            "exp": int(time.time()) + 600,
            "email_verified": True,
        })

        body = json.dumps({"id_token": b64({"alg": "RS256"}) + "." + b64(claims) + ".assinatura"}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", int(sys.argv[1]) if len(sys.argv) > 1 else 9099), Handler).serve_forever()
