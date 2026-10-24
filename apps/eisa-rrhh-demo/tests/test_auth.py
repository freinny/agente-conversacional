from app.auth import COOKIE_NAME


def test_requires_session(client):
    assert client.post("/api/chat", json={"message": "dotación"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/demo/questions").status_code == 401


def test_logout_revokes_replay(signed_in):
    token = signed_in.cookies.get(COOKIE_NAME)
    assert signed_in.get("/api/auth/me").status_code == 200
    assert signed_in.post("/api/auth/logout", json={}).status_code == 200
    assert signed_in.get("/api/auth/me").status_code == 401
    signed_in.cookies.set(COOKIE_NAME, token)
    assert signed_in.get("/api/auth/me").status_code == 401


def test_cookie_flags(client, credentials):
    response = client.post(
        "/api/auth/login", json={"username": "thesis-test", "password": credentials[0]}
    )
    cookie = response.headers["set-cookie"].lower()
    for flag in ["httponly", "secure", "samesite=strict", "path=/", "max-age=28800"]:
        assert flag in cookie
    assert "domain=" not in cookie


def test_rate_limit(client):
    for _ in range(5):
        assert (
            client.post(
                "/api/auth/login", json={"username": "wrong", "password": "wrong"}
            ).status_code
            == 401
        )
    assert (
        client.post("/api/auth/login", json={"username": "wrong", "password": "wrong"}).status_code
        == 429
    )


def test_origin_host_content_type(client, credentials):
    for origin in ["https://evil.example", "null", "https://testserver.evil.example"]:
        assert (
            client.post(
                "/api/auth/login",
                json={"username": "thesis-test", "password": credentials[0]},
                headers={"origin": origin},
            ).status_code
            == 403
        )
    assert client.get("/healthz", headers={"host": "evil.example"}).status_code == 400
    assert (
        client.post(
            "/api/auth/login", content="{}", headers={"content-type": "text/plain"}
        ).status_code
        == 415
    )


def test_no_echo_password(client):
    secret = "private-example-" * 10
    response = client.post("/api/auth/login", json={"username": "a", "password": secret})
    assert response.status_code == 422 and secret not in response.text


def test_body_limit(client):
    assert client.post("/api/chat", json={"message": "x" * 9000}).status_code == 413


def test_health_and_missing_api(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/readyz").status_code == 503
    assert client.get("/api/missing").status_code == 404
    assert "script-src 'self'" in client.get("/healthz").headers["content-security-policy"]


def test_only_one_suggested_question(signed_in):
    assert len(signed_in.get("/api/demo/questions").json()["questions"]) == 1
