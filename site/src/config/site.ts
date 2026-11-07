// ── Réglages du site : modifier ICI, jamais dans les pages ──────────────────
// Statut produit : 'beta' (test fermé) → 'lancement' (public) le jour venu.
export const site = {
  nom: 'NOVALYZ',
  signature: ['Mesurer.', 'Comprendre.', 'Progresser.'],
  url: 'https://www.novalyz.com',
  appUrl: 'https://app.novalyz.fr',
  email: 'hello@novalyz.fr',
  instagram: { handle: 'novalyzpro', url: 'https://www.instagram.com/novalyzpro/' },
  linkedin: null as null | string,            // à renseigner quand la page existera
  statut: 'beta' as 'beta' | 'lancement',
};

// Boutons d'appel : texte, lien, visibilité, selon le statut.
// Lot 4 : le formulaire /beta remplacera le lien e-mail provisoire.
export const cta = {
  principal: {
    beta: { texte: 'Rejoindre la bêta', lien: 'mailto:hello@novalyz.fr?subject=Rejoindre%20la%20b%C3%AAta%20Novalyz', visible: true },
    lancement: { texte: 'Découvrir Novalyz', lien: '/beta', visible: true },
  },
  secondaire: { texte: 'Voir comment ça marche', lien: '#comment', visible: true },
};
export const ctaPrincipal = cta.principal[site.statut];

// Emplacements de preuve sociale : vides tant qu'il n'y a rien de réel à montrer.
export const preuves = { temoignages: [] as { nom: string; texte: string }[], logos: [] as string[], chiffres: [] as { valeur: string; legende: string }[] };
