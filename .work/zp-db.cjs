// Copie de db_aliz.json avec la préférence zones_prio = ["fessiers"] (test local, pas la base réelle).
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('/home/user/Muscu_app/.work/audit/db_aliz.json'));
d.indicateurs = (d.indicateurs || []).concat([{ id: 999999, date: '2026-11-03', athlete_id: '2', seance_id: 'pref', cle: 'zones_prio', valeur: '["fessiers"]', unite: '', source: 'app' }]);
fs.writeFileSync('/home/user/Muscu_app/.work/audit/db_aliz_zp.json', JSON.stringify(d));
console.log('ok');
