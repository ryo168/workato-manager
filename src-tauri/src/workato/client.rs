use reqwest::Client;
use tauri::AppHandle;

use crate::logger;

pub struct ApiResponse {
    pub status: reqwest::StatusCode,
    pub body: String,
}

impl ApiResponse {
    pub fn is_success(&self) -> bool {
        self.status.is_success()
    }

    pub fn json<T: serde::de::DeserializeOwned>(&self) -> Result<T, String> {
        serde_json::from_str(&self.body).map_err(|e| format!("JSON parse error: {}", e))
    }
}

pub struct WorkatoClient {
    pub client: Client,
    pub token: String,
    pub base_url: String,
    pub app: AppHandle,
}

impl WorkatoClient {
    pub fn new(token: String, base_url: String, proxy_url: Option<String>, app: AppHandle) -> Self {
        let mut builder = Client::builder();
        if let Some(ref url) = proxy_url {
            if !url.is_empty() {
                if let Ok(p) = reqwest::Proxy::all(url) {
                    builder = builder.proxy(p);
                }
            }
        }
        WorkatoClient {
            client: builder.build().unwrap_or_else(|_| Client::new()),
            token,
            base_url,
            app,
        }
    }

    pub async fn get(&self, path: &str) -> Result<ApiResponse, String> {
        let url = format!("{}{}", self.base_url, path);
        let start = std::time::Instant::now();
        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.token))
            .send()
            .await
            .map_err(|e| {
                let elapsed = start.elapsed().as_millis();
                let msg = format!("GET {} -> ERROR ({elapsed}ms) {e}", path);
                logger::write_log(&self.app, &msg);
                e.to_string()
            })?;
        let elapsed = start.elapsed().as_millis();
        let status = response.status();
        let body = response.text().await.map_err(|e| e.to_string())?;
        let preview: String = body.chars().take(500).collect();
        logger::write_log(&self.app, &format!("GET {} -> {} ({elapsed}ms)\n  Body: {}", path, status.as_u16(), preview));
        Ok(ApiResponse { status, body })
    }

    pub async fn put(&self, path: &str) -> Result<ApiResponse, String> {
        let url = format!("{}{}", self.base_url, path);
        let start = std::time::Instant::now();
        let response = self.client
            .put(&url)
            .header("Authorization", format!("Bearer {}", self.token))
            .send()
            .await
            .map_err(|e| {
                let elapsed = start.elapsed().as_millis();
                let msg = format!("PUT {} -> ERROR ({elapsed}ms) {e}", path);
                logger::write_log(&self.app, &msg);
                e.to_string()
            })?;
        let elapsed = start.elapsed().as_millis();
        let status = response.status();
        let body = response.text().await.map_err(|e| e.to_string())?;
        let preview: String = body.chars().take(500).collect();
        logger::write_log(&self.app, &format!("PUT {} -> {} ({elapsed}ms)\n  Body: {}", path, status.as_u16(), preview));
        Ok(ApiResponse { status, body })
    }
}
