/* ===================================================================
   Carnet de suivi — Configuration
   -------------------------------------------------------------------
   SEUL FICHIER À MODIFIER pour connecter la base Supabase.
   Supabase → Project Settings → API :
     • "Project URL"      → SUPABASE_URL
     • "Publishable key" → SUPABASE_ANON_KEY
   La clé "anon public" peut être publique (la base est protégée par ses
   règles de sécurité). Ne JAMAIS coller ici la clé "service_role".

   Tant que ces champs sont vides : MODE DÉMO (données dans ce navigateur
   uniquement, rien n'est partagé).
   =================================================================== */
window.CARNET_CONFIG = {
  SUPABASE_URL: 'https://uudxoyvbgyyxgpczfozi.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_qsdxZ8cnCNoYn1zD7Gvz4w_ZO6GBe19', // clé publique « publishable » (protégée par la RLS)
};

// Tests en local uniquement : http://localhost:…/?demo → mode démo, sans toucher à la vraie base.
if (location.hostname === 'localhost' && new URLSearchParams(location.search).has('demo')) {
  window.CARNET_CONFIG.SUPABASE_URL = '';
  window.CARNET_CONFIG.SUPABASE_ANON_KEY = '';
}
