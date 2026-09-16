# Carnet de suivi

Carnet partagé et privé (parents + professionnels invités) pour suivre au quotidien un plan de prévention :
fiche du jour, épisodes, séances sensorielles, changements à préparer, essais « une modification à la fois »
et bilan imprimable pour les médecins.

- Aucune donnée dans ce dépôt : tout est dans une base Supabase protégée (Row Level Security).
- Une personne qui crée un compte ne voit rien tant que l'administrateur n'a pas accepté sa demande.

## Mise en place
1. Créer un projet Supabase (région Paris), puis coller `supabase/schema.sql` dans SQL Editor → Run.
2. Renseigner `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `js/config.js`.
3. Supabase → Authentication → URL Configuration : Site URL = adresse GitHub Pages du carnet.
4. Créer son compte depuis la page, puis lancer le bloc « PREMIER ADMINISTRATEUR » en bas de `schema.sql`.
