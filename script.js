
const SHEET_ID = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSdOjZm_tWpnBs6MYtrym6nzYy-C03eLLmgppOp_thgcjVoV9583zSm-si_acht5TDwwmZ9D4gFx1GN/pub?output=csv'; 

const SHEET_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(SHEET_ID)}`;

const appState = {
    player: { current: 0, max: 0 },
    defender: { current: 0, max: 0 },
    homunculus: { current: 0, max: 0 }
};

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
});

async function fetchData() {
    try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) throw new Error("Erro de conexão (Rede/Proxy)");
        
        const dataText = await response.text();
        
        // Verifica se veio HTML (erro comum, mas seu link parece certo)
        if (dataText.includes("<!DOCTYPE") || dataText.includes("<html")) {
            alert("ERRO: O link gerou um site, não um CSV. Verifique se a planilha está publicada como CSV.");
            return;
        }

        const db = parseCSV(dataText);
        
        // Verificação se leu algo útil
        if (!db.info.name && db.arsenal.length === 0) {
            console.log("Conteúdo recebido:", dataText);
            alert("O site conectou na planilha, mas não entendeu os dados. Verifique se as colunas A e B estão preenchidas corretamente (ex: 'info' na A, 'name' na B).");
        }

        loadDataToUI(db);
        initializeRuntimeState(db);
        updateDisplays();

    } catch (error) {
        console.error(error);
        alert("Erro ao carregar: " + error.message);
    }
}

function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    
    // Detecta separador (; ou ,)
    let separator = ',';
    const sample = lines.find(l => l.length > 5);
    if (sample && sample.includes(';')) separator = ';';

    const db = {
        info: {}, 
        attributes: { str:10, dex:10, con:10, int:10, wis:10, cha:10 },
        stats: { maxHp: 0, ac: 0, speed: "", initiative: 0, proficiencyBonus: 2 },
        spells: { cantrips: [], level1: [] }, 
        arsenal: [],
        companions: { 
            defender: { name: "Defensor", maxHp: 0, texts: {}, traits: [], actions: [], reactions: [] }, 
            homunculus: { name: "Homúnculo", maxHp: 0, texts: {}, traits: [], actions: [], reactions: [] } 
        }
    };

    lines.forEach((row) => {
        if (!row.trim()) return;
        const cols = row.split(separator);
        
        // MUDANÇA 2: Força tudo para minúsculo na leitura das chaves
        const type = cols[0] ? cols[0].trim().toLowerCase() : "";
        const keyRaw = cols[1] ? cols[1].trim() : "";
        const key = keyRaw.toLowerCase(); // Chave sempre minúscula (defender, str, etc)

        // Nas colunas de texto (C e D), mantemos a formatação original (Maiúsculas/Minúsculas)
        // Lógica para CSV que pode ter virgulas no texto:
        let name = "";
        let desc = "";

        if (separator === ';') {
            name = cols[2] ? cols[2].trim() : "";
            desc = cols[3] ? cols[3].trim() : "";
        } else {
            // Se for vírgula, tenta ser inteligente se o texto quebrou
            name = cols[2] ? cols[2].trim() : "";
            desc = cols.slice(3).join(',').trim(); // Junta o resto se tiver virgulas na descrição
        }
        
        // --- PARSER ---

        // Info e Atributos
        if(type === 'info') db.info[keyRaw] = name; // Usa keyRaw para info (pode ter camelCase)
        // Correção específica para 'name' que as vezes o user põe na coluna C ou D
        if(type === 'info' && key === 'name' && name === "") db.info.name = desc;

        if(type === 'attr') db.attributes[key] = parseInt(name) || 10;
        if(type === 'stat') db.stats[key] = (key === 'speed') ? name : parseInt(name);
        
        // Magias
        if(type.startsWith('spell')) {
            const list = type === 'spell0' ? db.spells.cantrips : db.spells.level1;
            // Verifica se tem nome, senão ignora
            if(keyRaw) list.push({ name: keyRaw, desc: name }); 
            // Nota: Se usou a tabela nova, o NOME tá na coluna B (keyRaw) e DESC na C (name)
        }

        // Armas
        if(type === 'weapon') {
            // Padrão novo: A=weapon, B=Nome, C=Tipo, D=Dano
            const isWpn = desc.toLowerCase().includes('d');
            db.arsenal.push({ 
                name: keyRaw, // Nome da arma (Coluna B)
                type: name,   // Tipo (Coluna C)
                isWeapon: isWpn, 
                damageDie: desc, // Dano (Coluna D)
                bonusAtk: 1 
            });
        }
        
        // --- PETS (Lógica Nova) ---
        if(type.startsWith('pet')) {
            let pet = db.companions[key]; // key agora é 'defender' ou 'homunculus' (minúsculo)
            
            if(pet) {
                if(type === 'pet') {
                    pet.name = name; // Nome visual (Defensor de Aço)
                    pet.maxHp = parseInt(desc) || 0; // Vida numérica
                }
                else if(type === 'pet_txt') {
                    // Salva chaves como 'ac', 'speed'
                    pet.texts[name.toLowerCase()] = desc;
                }
                else if(type === 'pet_trait') {
                    pet.traits.push({ title: name, text: desc });
                }
                else if(type === 'pet_action') {
                    pet.actions.push({ title: name, text: desc });
                }
                else if(type === 'pet_reaction') {
                    pet.reactions.push({ title: name, text: desc });
                }
            }
        }
    });
    return db;
}

function loadDataToUI(d) {
    if (!d.info.name && !d.info.Name) return; 

    // Tenta pegar o nome de várias formas caso a planilha tenha mudado
    const charName = d.info.name || d.info.Name || "Personagem";

    setText('char-name', charName);
    setText('char-title', d.info.title);
    setText('char-level-display', d.info.level);
    setText('char-race', d.info.race);
    setText('char-class', d.info.classInfo);
    setText('bio-background', d.info.background);
    setText('bio-align', d.info.alignment);
    setText('bio-age', d.info.age);
    setText('bio-physique', d.info.heightWeight);
    setText('bio-appearance', d.info.appearance);
    setText('char-lore', d.info.lore);
    setText('footer-name', charName);
    setText('footer-lvl', d.info.level);

    updateAttributeDisplay('str', d.attributes.str);
    updateAttributeDisplay('dex', d.attributes.dex);
    updateAttributeDisplay('con', d.attributes.con);
    updateAttributeDisplay('int', d.attributes.int);
    updateAttributeDisplay('wis', d.attributes.wis);
    updateAttributeDisplay('cha', d.attributes.cha);

    const intMod = Math.floor((d.attributes.int - 10) / 2);
    const lvl = parseInt(d.info.level || 1);
    const pb = Math.ceil(lvl / 4) + 1;
    const spellAtk = intMod + pb;
    const spellDc = 8 + intMod + pb;

    setText('stat-ac', d.stats.ac);
    setText('stat-init', d.stats.initiative);
    setText('stat-speed', d.stats.speed);
    setText('prof-bonus', `+${pb}`);
    setText('spell-atk', `+${spellAtk}`);
    setText('spell-dc', spellDc);

    document.querySelectorAll('.dyn-pb').forEach(el => el.innerText = pb);
    document.querySelectorAll('.dyn-spell-atk').forEach(el => el.innerText = spellAtk);

    renderList('list-cantrips', d.spells.cantrips);
    renderList('list-level1', d.spells.level1);
    renderArsenal('weapons-container', d.arsenal, spellAtk, intMod);

    renderPetCard('defender', d.companions.defender);
    renderPetCard('homunculus', d.companions.homunculus);
}

function renderPetCard(petId, petData) {
    setText(petId === 'defender' ? 'def-name' : 'hom-name', petData.name);
    if(petData.maxHp > 0) appState[petId].max = petData.maxHp;

    const cssClass = petId === 'defender' ? '.steel-defender' : '.homunculus';
    const container = document.querySelector(`${cssClass} .stat-content`);
    
    if(!container) return;

    let html = '';
    const txt = petData.texts;
    // Tenta pegar em ingles ou portugues
    const ac = txt['ca'] || txt['ac'] || txt['armor class'] || '--';
    const speed = txt['desl'] || txt['desl.'] || txt['speed'] || '--';
    const stats = txt['stats'] || txt['atributos'] || '--';
    const skills = txt['pericias'] || txt['skills'] || '';
    const immun = txt['imunes'] || txt['immunities'] || '';
    const senses = txt['sentidos'] || txt['senses'] || '';

    html += `
        <div class="stat-header-line">
            <span><strong>CA:</strong> ${ac}</span>
            <span><strong>Desl:</strong> ${speed}</span>
        </div>
        <div class="stat-header-line" style="margin-top:5px; font-size:0.85em; color:#ccc;">
            <span>${stats}</span>
        </div>
    `;

    html += `<div class="stat-actions" style="margin-top: 10px; font-size: 0.9em;">`;
    
    if(skills) html += `<p><strong>Perícias:</strong> ${skills}</p>`;
    if(immun)  html += `<p><strong>Imunidades:</strong> ${immun}</p>`;
    if(senses) html += `<p><strong>Sentidos:</strong> ${senses}</p>`;
    
    html += `<hr style="border-color: #444; margin: 8px 0;">`;

    petData.traits.forEach(t => {
        html += `<div class="action-item"><strong>${t.title}</strong> ${t.text}</div>`;
    });

    if(petData.actions.length > 0) {
        html += `<h5 style="margin-top:8px; color:var(--text-main);">Ações</h5>`;
        petData.actions.forEach(a => {
            html += `<div class="action-item"><strong>${a.title}</strong> ${a.text}</div>`;
        });
    }

    if(petData.reactions.length > 0) {
        html += `<h5 style="margin-top:8px; color:var(--text-main);">Reações</h5>`;
        petData.reactions.forEach(r => {
            html += `<div class="action-item"><strong>${r.title}</strong> ${r.text}</div>`;
        });
    }
    html += `</div>`; 

    container.innerHTML = html;
}

function initializeRuntimeState(d) {
    appState.player.max = d.stats.maxHp || 10;
    appState.player.current = d.stats.maxHp || 10;
}
function renderList(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return; container.innerHTML = ''; 
    list.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${item.name}</strong><p class="desc">${item.desc}</p>`;
        li.onclick = () => li.classList.toggle('active');
        container.appendChild(li);
    });
}
function renderArsenal(containerId, list, spellAtk, intMod) {
    const container = document.getElementById(containerId);
    if (!container) return; container.innerHTML = '';
    list.forEach(item => {
        if (item.isWeapon) {
            const hit = spellAtk + (item.bonusAtk || 0);
            const dmgBonus = intMod + (item.bonusAtk || 0);
            const html = `<div class="weapon-card main-weapon"><div class="weapon-icon"><i class="fas fa-gavel"></i></div><div class="weapon-info"><h4>${item.name}</h4><span class="weapon-type">${item.type}</span></div><div class="weapon-stats"><div class="w-hit"><span class="label">Acerto</span><span class="val">+${hit}</span></div><div class="w-dmg"><span class="label">Dano</span><span class="val">${item.damageDie} + ${dmgBonus}</span></div></div></div>`;
            container.innerHTML += html;
        } else {
            const html = `<div class="spells-category" style="margin-bottom:10px;"><ul class="spell-list"><li onclick="this.classList.toggle('active')"><strong>${item.name}</strong><p class="desc">${item.desc}</p></li></ul></div>`;
            container.innerHTML += html;
        }
    });
}
function updateAttributeDisplay(attr, score) {
    const mod = Math.floor((score - 10) / 2);
    setText(`score-${attr}`, score);
    setText(`mod-${attr}`, mod >= 0 ? `+${mod}` : mod);
}
function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function modifyHP(target, amount) {
    const entity = appState[target]; if (!entity) return;
    entity.current += amount;
    if (entity.current > entity.max) entity.current = entity.max;
    if (entity.current < 0) entity.current = 0;
    updateDisplays();
}
function updateDisplays() {
    updateBar('hp-bar', 'current-hp', 'max-hp', appState.player);
    updateBar('defender-hp-bar', 'defender-hp-text', null, appState.defender, true);
    updateBar('homunculus-hp-bar', 'homunculus-hp-text', null, appState.homunculus, true);
}
function updateBar(barId, textId, maxId, entity, isCompact = false) {
    const bar = document.getElementById(barId);
    const textEl = document.getElementById(textId);
    const maxEl = maxId ? document.getElementById(maxId) : null;
    if (bar && textEl) {
        if (maxEl) maxEl.innerText = entity.max;
        textEl.innerText = isCompact ? `${entity.current}/${entity.max}` : entity.current;
        const percent = Math.max(0, Math.min(100, (entity.current / entity.max) * 100));
        bar.style.width = `${percent}%`;
        const hue = Math.floor(percent * 1.2); 
        bar.style.backgroundColor = `hsl(${hue}, 100%, 40%)`;
    }
}