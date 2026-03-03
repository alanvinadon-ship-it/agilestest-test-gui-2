# 🌐 Guide de Déploiement Permanent — AgilesTest

Ce guide vous permet de transformer la plateforme temporaire en un **site web permanent** accessible via votre propre nom de domaine (ex: `https://votre-plateforme.com`) sur un serveur VPS (AWS, DigitalOcean, OVH, Hetzner, etc.).

## 📋 Prérequis

1.  **Un serveur VPS** : Ubuntu 22.04 LTS recommandé (2 vCPU, 4 Go RAM minimum).
2.  **Un nom de domaine** : Pointant vers l'adresse IP de votre VPS (Enregistrement A).
3.  **Accès SSH** : Clé SSH ou mot de passe root.

---

## 🚀 Étape 1 : Préparation du serveur

Connectez-vous à votre serveur via SSH :

```bash
ssh root@192.168.200.83
```

Mettez à jour le système :

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 📦 Étape 2 : Récupération du projet

Clonez le repository GitHub contenant la configuration finale :

```bash
git clone https://github.com/alanvinadon-ship-it/agilestest-test-gui-2.git
cd agilestest-test-gui-2/deploy/prod
```

---

## ⚙️ Étape 3 : Déploiement One-Click

Rendez le script d'installation exécutable et lancez-le :

```bash
chmod +x setup.sh
./setup.sh
```

Le script va automatiquement :
-   Installer **Docker**, **Node.js** et **Nginx**.
-   Générer des **secrets sécurisés** (JWT, AES-256).
-   Lancer la base de données **MySQL** et le stockage **MinIO**.
-   Configurer **Keycloak** pour l'authentification.
-   Installer les services **systemd** pour le redémarrage automatique au boot.

---

## 🔒 Étape 4 : HTTPS & Nom de domaine (Optionnel mais recommandé)

Pour sécuriser votre site avec un certificat SSL gratuit (Let's Encrypt) :

1.  Modifiez le fichier `/etc/nginx/sites-available/agilestest` pour remplacer `localhost` par votre domaine.
2.  Installez Certbot :

```bash
sudo apt install certbot python3-certbot-nginx -y
```

3.  Générez le certificat :

```bash
sudo certbot --nginx -d votre-domaine.com
```

---

## 🛠️ Maintenance & Commandes utiles

-   **Voir les logs du backend** : `journalctl -u agilestest-backend -f`
-   **Redémarrer la plateforme** : `sudo systemctl restart agilestest-docker agilestest-backend`
-   **Accéder à Keycloak** : `http://192.168.200.83:8180` (Identifiants par défaut : admin / admin)
-   **Accéder à MinIO** : `http://192.168.200.83:9001` (Identifiants par défaut : minioadmin / minioadmin)

---

## 📧 Support & Configuration SMTP

Une fois connecté en tant qu'administrateur (`admin@agilestest.local` / `Admin@2026!`), allez dans **Administration > Notifications** pour configurer votre serveur SMTP (Gmail, Outlook, Brevo) et activer l'envoi réel d'e-mails.
