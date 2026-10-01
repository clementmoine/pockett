# Klarna (Pockett)

Credential = `refresh_token` web (`app.klarna.com`), pas d’API publique.

1. Menu **⋯ → Comptes liés** → lier Klarna (autres services à venir)  
2. Token persisté dans `/config/klarna-refresh-token`  
3. Catalogue providers syncé via loyalty BFF

Le refresh token web expire / est révoqué si tu te reconnectes sur Klarna
ailleurs, ou après un `invalid_grant`. Dans ce cas Pockett efface le fichier
et affiche à nouveau « Se connecter ».

`GET /api/klarna/setup` ne force plus un refresh à chaque appel : l’access
token en mémoire (~5 min) est réutilisé. Pendant l’attente de connexion,
`?soft=1` ne regarde que la présence du fichier (l’ingest a déjà validé le
grant). Un refresh OAuth n’est jamais retried (rotation one-shot). Après un
refresh réussi le fichier est toujours réécrit. Un `invalid_grant` l’efface.

## Keepalive

Tant que le process Node tourne (Docker, `next start`), un refresh forcé
part toutes les **12 h** pour exercer le `refresh_token` et éviter qu’il
dorme trop longtemps. `KLARNA_KEEPALIVE_MS` pour changer l’intervalle ;
`0` pour couper.

Si Pockett est **éteint** plusieurs jours, le keepalive ne tourne pas :
Klarna peut quand même révoquer, il faudra reconnecter.

Fichiers : `ConnectionsModal`, `connections/KlarnaConnection`, extension Connector, `/api/klarna/*`
