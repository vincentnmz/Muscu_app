// ── Réglages du site : modifier ICI, jamais dans les pages ──────────────────
// Statut produit : 'beta' (test fermé) → 'lancement' (public) le jour venu.
export const site = {
  nom: 'NOVALYZ',
  signature: ['Mesurer.', 'Comprendre.', 'Progresser.'],
  url: 'https://www.novalyz.com',
  appUrl: 'https://app.novalyz.fr',
  api: 'https://jhbrvgguybynzeceeceu.supabase.co/functions/v1/smooth-service',   // serveur de l'app (action publique inscriptionBeta)
  email: 'hello@novalyz.fr',
  instagram: { handle: 'novalyzpro', url: 'https://www.instagram.com/novalyzpro/' },
  linkedin: null as null | string,            // à renseigner quand la page existera
  statut: 'beta' as 'beta' | 'lancement',
};

// Mentions légales. Éditeur = personne physique, pas encore de statut (à compléter le jour où une
// micro-entreprise / société existe : ajouter forme, SIREN, adresse).
export const editeur = {
  nom: 'Vincent Portefaix',
  statut: null as null | { forme: string; siren: string; adresse: string },
};
export const hebergeurSite = { nom: 'GitHub, Inc.', adresse: '88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis', url: 'https://github.com' };

// Boutons d'appel : texte, lien, visibilité, selon le statut.
export const cta = {
  principal: {
    beta: { texte: 'Rejoindre la bêta', lien: '/beta/', visible: true },
    lancement: { texte: 'Découvrir Novalyz', lien: '/beta/', visible: true },
  },
  secondaire: { texte: 'Voir comment ça marche', lien: '#comment', visible: true },
};
export const ctaPrincipal = cta.principal[site.statut];

// Emplacements de preuve sociale : vides tant qu'il n'y a rien de réel à montrer.
export const preuves = { temoignages: [] as { nom: string; texte: string }[], logos: [] as string[], chiffres: [] as { valeur: string; legende: string }[] };
