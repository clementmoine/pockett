# Lidl (Pockett)

Une seule carte Lidl, celle du catalogue Klarna : un QR statique.

**Comptes liés → Lidl** est un complément de cette carte. Sans compte lié,
l’afficher ne fait que montrer le QR. Avec un compte lié, le même QR s’affiche
et les promotions disponibles sont activées.

| | Sans compte | Compte lié |
|--|--|--|
| Carte | Lidl (Klarna) | La même |
| Au verso ou en plein écran | QR seul | QR, puis activation des promos |
| Login | Non | Connecteur navigateur (comme Klarna), code SMS sur la page Lidl |

Le refresh token est dans `lidl-account` (pas sur la carte). Le formulaire
d’ajout de carte ne connaît pas Lidl : pas de mot de passe, pas d’empreinte,
pas de provider « Lidl Plus ».

Le core ne branche pas sur le nom de l’enseigne. Un compte lié déclare les
providers qu’il complète (`CONNECTION_SERVICES[].enhances`). Aujourd’hui Lidl
complète les trois ids Klarna :

- `krn:consumer-wallet-eu:provider:6027d50c-f6b2-4304-9eb9-3ad8cc0f48df`
- `krn:consumer-wallet-eu:provider:ec21fe1e-c1d6-4b29-bba1-e4fa233174a7`
- `krn:consumer-wallet-eu:loyalty-program:044616a3-0faa-49ba-846c-536f32ce492c`

Un autre enseigne pourra réutiliser le même chemin : `enhances` + un runner
dans `connection-enhance.ts`.

Sources API (non officielles, peuvent casser) :
[Andre0512/lidl-plus](https://github.com/Andre0512/lidl-plus),
[klajbard/lidl-plus-go](https://github.com/klajbard/lidl-plus-go).

## Connexion

1. Menu **Comptes liés** → **Se connecter avec Lidl**
2. L’extension ouvre `accounts.lidl.com` (reCAPTCHA et SMS dans le vrai navigateur)
3. Elle récupère le `code` du redirect `com.lidlplus.app://callback`
4. `POST /api/connections/bridge` l’échange contre un refresh token

| Étape | Détail |
|-------|--------|
| Authorize | `GET accounts.lidl.com/connect/authorize` |
| Client | `LidlPlusNativeClient` |
| Scope | `openid profile offline_access lpprofile lpapis` |
| Redirect | `com.lidlplus.app://callback` |
| Token | `POST accounts.lidl.com/connect/token` |
| Basic | `base64(LidlPlusNativeClient:secret)` |
| Refresh | `grant_type=refresh_token` (le refresh peut tourner) |

Le mot de passe et le reCAPTCHA restent dans le navigateur. Pockett ne les
voit pas et ne les stocke pas.

## Affichage

La page charge `GET /api/connections`. `providerIds` liste les cartes à
compléter, vide si le compte n’est pas lié.

Au flip ou en plein écran, la carte envoie `POST /api/cards/:id/enhance`.
Ça n’écrit pas `card.code` et ne remplace pas le QR. Sans compte lié, aucun
appel.

`refreshLinkedLidlAccount` rafraîchit le token puis active les promos encore
valides et pas déjà activées. Un échec d’activation est journalisé : le QR
reste affiché.

## Coupons

Base : `https://coupons.lidlplus.com/app/api`.

| Action | Appel |
|--------|--------|
| Liste | `GET /v2/promotionslist` (repli `/v4/promotionslist`) |
| Activer | `POST /v1/promotions/{id}/activation`, puis `/v2/.../activation` |

Header `Country` obligatoire (ex. `FR`). `Segment-ids` est envoyé quand les
segments du compte répondent. Corps d’activation v2 :
`{ "articleSelection": [] }`. L’id est `promotion.id`.

| Header | Valeur |
|--------|--------|
| `Authorization` | `Bearer` access token |
| `App` | `com.lidl.eci.lidlplus` |
| `App-Version` | `16.43.4` |
| `Operating-System` | `Android` |
| `User-Agent` | `okhttp/5.4.0` |

Rester en HTTP/1.1.

## Fichiers

- `connections.ts` — service `lidl` (`enhances`, `oauthRedirect`)
- `connection-enhance.ts` — statut, login, effet au verso
- `lidl-login.ts` — PKCE, échange du code, refresh
- `lidl-auth.ts` — compte `lidl-account` + activation des promos
- `api/connections` — `GET` statut + `providerIds`, `POST` dissociation
- `api/connections/bridge` — start / poll / complete
- `api/cards/[id]/enhance` — effet au verso ou en plein écran, QR inchangé
