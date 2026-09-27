# Klarna (Pockett)

Credential = `refresh_token` web (`app.klarna.com`), pas d’API publique.

1. Menu **⋯ → Comptes liés** → lier Klarna (autres services à venir)  
2. Token persisté dans `/config/klarna-refresh-token`  
3. Catalogue providers syncé via loyalty BFF

Fichiers : `ConnectionsModal`, `connections/KlarnaConnection`, extension Connector, `/api/klarna/*`
