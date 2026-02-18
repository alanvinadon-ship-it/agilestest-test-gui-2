# Troubleshooting — AgilesTest

## "Accès refusé" (403) — Page ou action bloquée

**Symptôme** : Un écran "Accès refusé" s'affiche, ou un bouton est grisé/absent, ou une action retourne une erreur 403.

**Diagnostic rapide** :

| Vérification | Commande / Action | Résultat attendu |
|-------------|-------------------|-------------------|
| **1. Check membership** | Demander à un admin de vérifier **Admin → Accès Projets** | L'utilisateur doit avoir une membership active sur le projet |
| **2. Check rôle global** | Demander à un admin de vérifier **Admin → Utilisateurs** | Le rôle global (VIEWER/MANAGER/ADMIN) détermine les permissions |
| **3. Check permission spécifique** | Consulter **Admin → Matrice RBAC** | Vérifier que le rôle possède la permission requise pour l'action |
| **4. Check statut compte** | Vérifier que le compte n'est pas désactivé | Un compte désactivé ne peut plus se connecter |

**Cas courants** :

### Cas 1 : Pas de membership projet

L'utilisateur n'est pas membre du projet. Le guard `RequireProjectAccess` bloque l'accès à toutes les routes projet.

**Solution** : L'administrateur ajoute l'utilisateur au projet via **Admin → Accès Projets → Ajouter un membre**.

### Cas 2 : Rôle insuffisant pour l'action

L'utilisateur est membre mais son rôle ne permet pas l'action tentée. Exemples :
- VIEWER ne peut pas créer, modifier ou supprimer
- MANAGER ne peut pas supprimer ni accéder à l'administration

**Solution** : L'administrateur change le rôle global de l'utilisateur via **Admin → Utilisateurs → Modifier**.

### Cas 3 : Rôle custom sans la permission requise

Si l'utilisateur a un rôle personnalisé, celui-ci peut ne pas inclure la permission nécessaire.

**Solution** : L'administrateur vérifie les permissions du rôle custom via **Admin → Rôles** et ajoute la permission manquante.

### Utiliser le trace_id pour le diagnostic

L'écran d'erreur 403 affiche un `trace_id` unique. Communiquez ce trace_id à l'administrateur pour faciliter le diagnostic :

1. L'administrateur recherche le trace_id dans le **Journal d'audit** (`/admin/audit`)
2. Le journal montre l'action tentée, l'entité concernée et le rôle de l'utilisateur
3. L'administrateur peut alors ajuster les permissions ou la membership

> **Astuce** : Le trace_id est aussi visible dans les logs du navigateur (console F12) pour les développeurs.

---

## "No ACTIVE script" — Le Run Center bloque le lancement

**Symptôme** : Le bouton "Lancer l'exécution" est désactivé et un message indique qu'aucun script ACTIVE n'existe pour le scénario sélectionné.

**Cause** : Aucune version de script n'a été marquée comme ACTIVE pour ce scénario. Le Run Center exige un script ACTIVE pour lancer une exécution.

**Solution** :

1. Accédez à **Scripts Générés** (`/scripts`)
2. Filtrez par le scénario concerné
3. Si aucun script n'existe, retournez dans le scénario et utilisez **Générer Script** (ou **Générer Prompt** pour utiliser un LLM externe)
4. Une fois le script créé, cliquez sur **Activer** dans la liste des scripts
5. Retournez au Run Center — le script ACTIVE sera automatiquement sélectionné

---

## "No compatible bundle" — Aucun bundle disponible pour l'environnement

**Symptôme** : Le sélecteur de bundle dans le Run Center est vide ou affiche "Aucun bundle compatible".

**Cause** : Aucun bundle ACTIVE ne correspond à l'environnement sélectionné, ou le bundle existant ne couvre pas tous les `required_dataset_types` du scénario.

**Solution** :

1. Accédez à **Bundles** (`/bundles`)
2. Vérifiez qu'un bundle existe pour l'environnement cible (DEV, PREPROD, etc.)
3. Si le bundle existe mais n'est pas compatible, cliquez sur **Valider** pour voir les types manquants
4. Ajoutez les dataset instances manquantes au bundle
5. Passez le bundle en statut **ACTIVE**
6. Si aucun bundle n'existe, créez-en un nouveau avec toutes les instances requises

---

## "Missing dataset types/keys" — Types ou clés manquants dans un bundle

**Symptôme** : La validation d'un bundle indique des types de dataset manquants ou des clés absentes dans une instance.

**Cause** : Le bundle ne contient pas d'instance pour chaque `required_dataset_type` du scénario, ou une instance ne contient pas tous les champs obligatoires définis dans le gabarit (Dataset Type).

**Solution** :

1. Consultez le détail de la validation pour identifier les types manquants
2. Pour chaque type manquant :
   - Accédez à **Datasets (Instances)** (`/datasets`)
   - Créez une nouvelle instance du type requis pour le bon environnement
   - Remplissez tous les champs obligatoires (marqués d'un astérisque)
   - Activez l'instance
3. Retournez dans le bundle et ajoutez les nouvelles instances
4. Relancez la validation

---

## "Runner unreachable / no jobs" — Le runner ne reçoit pas de jobs

**Symptôme** : Les exécutions restent en statut PENDING indéfiniment. Le runner ne semble pas récupérer les jobs.

**Cause possible 1 — Runner non démarré** :

```bash
docker ps | grep agilestest-runner
```

Si le conteneur n'apparaît pas, démarrez-le :

```bash
docker-compose -f docker-compose.runner.yml up -d runner
```

**Cause possible 2 — Orchestration API inaccessible** :

Vérifiez que le service Orchestration est opérationnel :

```bash
curl http://localhost:4000/api/v1/jobs?status=PENDING
```

Si la requête échoue, redémarrez l'Orchestration :

```bash
docker-compose -f docker-compose.runner.yml restart orchestration
```

**Cause possible 3 — Mauvaise URL d'Orchestration** :

Vérifiez que la variable `ORCHESTRATION_URL` du runner pointe vers la bonne adresse. En docker-compose, utilisez le nom de service (`http://orchestration:4000`).

**Cause possible 4 — Erreur réseau Docker** :

Vérifiez que les services sont sur le même réseau Docker :

```bash
docker network ls
docker network inspect agilestest-test-gui_default
```

---

## "MinIO upload failed" — Échec d'upload des artefacts

**Symptôme** : L'exécution se termine mais les artefacts ne sont pas disponibles dans le détail d'exécution. Les logs du runner indiquent des erreurs S3.

**Cause possible 1 — MinIO non démarré** :

```bash
docker ps | grep minio
```

Vérifiez le health check :

```bash
curl http://localhost:9000/minio/health/live
```

**Cause possible 2 — Bucket inexistant** :

Le bucket `agilestest-artifacts` doit exister. Vérifiez via la console MinIO (`http://localhost:9001`) ou la CLI :

```bash
docker exec agilestest-minio-init mc ls local/agilestest-artifacts
```

Si le bucket n'existe pas, recréez-le :

```bash
docker-compose -f docker-compose.runner.yml restart minio-init
```

**Cause possible 3 — Credentials incorrects** :

Vérifiez que les variables `MINIO_ACCESS_KEY` et `MINIO_SECRET_KEY` du runner correspondent à celles du serveur MinIO.

**Cause possible 4 — Espace disque insuffisant** :

Vérifiez l'espace disponible sur le volume MinIO :

```bash
docker exec agilestest-minio df -h /data
```

---

## "Selectors flaky" — Tests instables à cause des sélecteurs CSS

**Symptôme** : Les tests passent parfois et échouent parfois sur les mêmes étapes. Les screenshots montrent que l'élément existe mais n'est pas trouvé.

**Recommandations de stabilisation** :

1. **Préférer `data-testid`** : Utilisez des attributs `data-testid` stables plutôt que des sélecteurs CSS basés sur les classes ou la structure DOM.

2. **Attendre explicitement** : Utilisez `page.waitForSelector()` ou `expect(locator).toBeVisible()` avant d'interagir avec un élément.

3. **Éviter les index** : Ne pas utiliser `nth-child` ou `nth-of-type` qui dépendent de l'ordre des éléments dans le DOM.

4. **Utiliser les rôles ARIA** : `page.getByRole('button', { name: 'Valider' })` est plus stable que `page.click('.btn-primary')`.

5. **Configurer les timeouts** : Augmentez le timeout par défaut si l'application est lente à charger :

```typescript
test.use({ actionTimeout: 10000 });
```

6. **Lors du repair IA** : Mentionnez les sélecteurs problématiques dans les logs d'incident pour que l'IA propose des alternatives plus stables.

---

## "Repair propose patch non applicable" — Le patch IA ne résout pas le problème

**Symptôme** : Après un repair, la nouvelle version du script échoue sur la même erreur ou sur une erreur différente.

**Causes possibles** :

1. **Contexte insuffisant** : Le repair IA n'a pas assez d'informations pour comprendre l'erreur. Vérifiez que les artefacts (logs, screenshots) sont bien disponibles et pertinents.

2. **Erreur d'environnement** : L'erreur peut être liée à l'environnement (service indisponible, données manquantes) plutôt qu'au script. Vérifiez l'état de l'application cible.

3. **Limitation du repair simulé** : Le repair IA est actuellement **simulé** (MVP). Les patches proposés sont des exemples et ne reflètent pas une analyse réelle des erreurs.

**Actions recommandées** :

1. Consultez le diff viewer pour comprendre les modifications proposées
2. Si le patch n'est pas pertinent, ne l'activez pas — utilisez plutôt **Générer Prompt** pour obtenir un prompt de repair que vous pouvez soumettre à un LLM externe avec plus de contexte
3. Modifiez manuellement le script si nécessaire et créez une nouvelle version
4. Relancez l'exécution avec la version corrigée

> **Note** : Lorsqu'un vrai LLM sera branché sur l'endpoint de repair, la qualité des patches sera significativement améliorée grâce à l'analyse des artefacts réels (logs, screenshots, traces).
