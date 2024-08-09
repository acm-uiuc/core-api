def test_get_events(api_client):
    response = api_client.get("/api/v1/events")
    assert response.status_code == 200
    assert response.json() != []
    
def test_post_events_unauthenticated(api_client):
    response = api_client.post("/api/v1/events")
    assert response.status_code == 403
    assert response.json()