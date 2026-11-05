-- Novalyz — Réglages coach (écran 9, 05/11/2026) — appliqué en prod le 05/11 (migration coachs_prefs).
-- prefs = { notif:{messages,douleur,resume,chaque,calme}, groupes:[{nom,ids:[athlete_id]}],
--           defauts:{novalyz_athlete:bool, semaine_type:'calendaire'|'glissant'}, resume_dernier:'YYYY-MM-DD' }
alter table public.coachs add column if not exists prefs jsonb not null default '{}'::jsonb;
