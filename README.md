# Salfer Eco-Tycoon

Jogo idle de construção de império de energia limpa.

## Funcionalidades

- 5 idiomas (PT, EN, ES, FR, DE)
- PWA instalável
- Sistema de referências
- Backend Firebase (realtime)
- Leaderboard global
- Offline support

## Setup Firebase

1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. Criar novo projeto "salfer-eco-tycoon"
3. Ativar Firestore Database
4. Ativar Authentication (Anónimo)
5. Ativar Analytics
6. Copiar config para `firebase-config.js`

### Regras Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /players/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /stats/{statId} {
      allow read: if true;
    }
    match /referrals/{refId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Deploy Vercel

1. Instalar Vercel CLI: `npm i -g vercel`
2. Na pasta do projeto: `vercel`
3. Seguir instruções
4. Domínio automático: `salfer-eco-tycoon.vercel.app`

## Estrutura

```
/
├── index.html          # Jogo principal
├── sw.js               # Service Worker
├── manifest.json       # PWA manifest
├── salfer-backend.js   # Firebase integration
├── firebase-config.js  # Firebase config
├── vercel.json         # Vercel config
└── README.md           # Este ficheiro
```

## Analytics Events

- `new_player` - Novo jogador
- `referral_completed` - Referência completada
- `building_built` - Edifício construído
- `rank_up` - Subiu de rank
- `purchase` - Compra feita
- `share` - Partilha em rede social

## Monetização

- AdSense integrado
- Sistema de créditos preparado para IAP
- Referral system para viralização

## Licença

Propriedade de Salfer Co.
