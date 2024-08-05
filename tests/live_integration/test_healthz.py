def test_healthz(api_client):
    response = api_client.get("/api/v1/healthz")
    assert response.status_code == 200