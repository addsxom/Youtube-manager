# YTB Manager

YTB Manager est une application locale pour **gérer, nettoyer et analyser ses abonnements YouTube**.

Tout tourne sur ton PC : tes données restent dans la base locale du projet.

## Ce qu'il faut avant de commencer

Installe simplement :

- **Python 3.11+** : https://www.python.org/downloads/
- **Node.js 20+** : https://nodejs.org/

Pendant l'installation de Python, coche **Add Python to PATH**.

> Google OAuth est obligatoire pour connecter ton compte YouTube.

---

# Installation

## 1. Télécharger le projet

Télécharge le projet puis **décompresse le dossier**.

Tu dois avoir quelque chose comme :

```text
Youtube-manager/
├── backend/
├── frontend/
├── data/
├── start.bat
└── requirements.txt
```

---

## 2. Créer le fichier Google OAuth

YTB Manager a besoin d'un fichier nommé :

```text
client_secret.json
```

### Étapes rapides

1. Ouvre Google Cloud Console : https://console.cloud.google.com/
2. Crée un nouveau projet, par exemple **YTB Manager**.
3. Va dans **APIs & Services → Library** et active **YouTube Data API v3**.
4. Ouvre **Google Auth Platform** : https://console.cloud.google.com/auth/overview
5. Configure l'application avec une audience **External**.
6. Dans **Audience → Test users**, ajoute l'adresse Google que tu vas connecter à YTB Manager.
7. Va dans **Clients → Create client**.
8. Choisis **Desktop app**.
9. Télécharge le fichier JSON.
10. Renomme-le exactement :

```text
client_secret.json
```

Place-le ensuite **à côté de `start.bat`** :

```text
Youtube-manager/
├── client_secret.json   ← ICI
├── start.bat
├── backend/
└── frontend/
```

⚠️ Ne partage jamais `client_secret.json`.

### Tu ne sais pas faire la configuration OAuth ?

Vidéo rapide :
https://www.youtube.com/watch?v=cUx9qUkYJgk

Documentation Google :
https://developers.google.com/youtube/v3/guides/auth/installed-apps

---

## 3. Lancer YTB Manager

Double-clique sur :

```text
start.bat
```

Au premier lancement, le script installe automatiquement les dépendances nécessaires puis ouvre :

```text
http://127.0.0.1:5173
```

Deux fenêtres de terminal vont rester ouvertes : c'est normal.

---

## 4. Connecter YouTube

Dans YTB Manager :

1. clique sur **Se connecter avec Google** ;
2. sélectionne ton compte ;
3. accepte l'autorisation YouTube ;
4. reviens sur YTB Manager.

Un fichier `token.json` sera créé automatiquement pour garder ta session.

⚠️ Ne partage jamais `token.json`.

---

## 5. Première synchronisation

Clique sur **Synchroniser** en haut à droite.

YTB Manager va récupérer tes abonnements, les informations des chaînes et leurs vidéos récentes.

La première synchronisation peut prendre un peu de temps si tu suis beaucoup de chaînes.

Après ça, tu peux utiliser :

- **Vue générale** pour voir rapidement l'état de tes abonnements ;
- **Mes chaînes** pour rechercher, filtrer, mettre en favoris ou se désabonner ;
- **Nettoyage** pour examiner les chaînes peu actives ;
- **Analyse** pour consulter les statistiques ;
- **Paramètres** pour modifier l'apparence, le son et les préférences.

---

# En cas de problème

### `client_secret.json` manquant

Le fichier doit être exactement ici :

```text
Youtube-manager/client_secret.json
```

### Google refuse la connexion

Vérifie que :

- **YouTube Data API v3** est activée ;
- le client OAuth est bien de type **Desktop app** ;
- ton adresse Google est présente dans **Audience → Test users**.

### `python` ou `npm` introuvable

Ferme et rouvre le terminal après avoir installé Python / Node.js.

Tu peux vérifier avec :

```bat
python --version
npm --version
```

---