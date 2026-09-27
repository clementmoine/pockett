# Grand Frais (Pockett)

Provider custom (`custom:grand-frais`). Le core ne branche pas sur le nom :
capacités via `provider-code.ts` / `provider-bootstrap.ts`.

## Ajout de carte

1. Provider **Grand Frais**
2. **Email + mot de passe** (compte app) — one-shot
3. Stockage session :
   `GFR|<memberId>|<shop>|<accessToken>|<refreshToken>[|<lastPrgf>]`
4. Mot de passe **non** conservé ; le dernier PRGF est mémorisé sur la carte

## Affichage QR

**Pas de génération locale** (formule CC incomplete).  
À l’ouverture : affiche le **dernier PRGF** tout de suite, puis refresh BFF
en arrière-plan (`/api/cards/:id/code` → `/v1/customer/qrcode`).

Anciennes cartes `GF|member|prefix` : reconnecter (email + mdp).

## Capacités provider

| Capacité | Grand Frais |
|----------|-------------|
| `bootstrap` | email / password |
| `remoteCode` | QR frais via BFF |
| `liveCode` | — (abandonné) |

## Fichiers

- `grand-frais-session.ts` — parse credential (client-safe)
- `grand-frais-auth.ts` — login / refresh / fetch QR
- `grand-frais-qr*.ts` — parse PRGF (caption memberId)
- `api/providers/bootstrap.ts` / `api/cards/[id]/code.ts`
