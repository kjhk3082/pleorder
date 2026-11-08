# Local Naver Maps setup

The Android WebView origin is `https://appassets.androidplatform.net`. Register that Web service URL and enable Dynamic Map, Geocoding, Reverse Geocoding and Directions 5 as needed. Static Map and Directions 15 are not required by this implementation.

Store configuration only in ignored `.local/naver-maps.json`:

```json
{"naverClientId":"YOUR_PUBLIC_ID","naverClientSecret":"YOUR_SERVER_SECRET"}
```

`tools/Build-Pleorder.ps1 -Install` copies only the public ID into the debug APK. Do not put the secret in assets, Gradle configuration, screenshots or Git.

## Development Directions server

The current machine has a local certificate/private key in `.local/preview-cert.pem` and `.local/preview-key.pem`. The certificate expires after 30 days; renew it before then. The debug build trusts this certificate for `10.0.2.2` only; it does not modify the OS trust store or release network policy.

From the repository root, run:

```powershell
$env:PLEORDER_HTTPS='1'
$env:PLEORDER_PORT='4174'
node tools/preview.cjs
```

The development server binds `127.0.0.1:4174`; the emulator accesses it via `https://10.0.2.2:4174/api/directions`. Keep it running when using real car routes. With no server, the app shows a route error and retains order information. A production backend with production TLS and application authorization is required for distribution; this loopback service is for local testing.

Generate a replacement local certificate with OpenSSL (adjust the OpenSSL executable path on Windows):

```text
openssl req -x509 -newkey rsa:2048 -sha256 -days 30 -nodes -keyout .local/preview-key.pem -out .local/preview-cert.pem -subj /CN=localhost -addext subjectAltName=DNS:localhost,IP:127.0.0.1,IP:10.0.2.2 -addext extendedKeyUsage=serverAuth
```

Restart the server and rebuild/install after replacing the certificate. HTTPS browser previews also require their own origin to be registered in the Naver console. The emulator origin is already validated; authorization is not bypassed for unregistered browser origins.

Official references: [Naver JS SDK](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html), [Directions 5](https://api.ncloud-docs.com/docs/en/application-maps-directions5).
