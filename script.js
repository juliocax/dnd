
const DEFAULT_SHEET = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSdOjZm_tWpnBs6MYtrym6nzYy-C03eLLmgppOp_thgcjVoV9583zSm-si_acht5TDwwmZ9D4gFx1GN/pub?output=csv'; 

const appState = {
    player: { current: 0, max: 0 },
    defender: { current: 0, max: 0 },
    homunculus: { current: 0, max: 0 }
};
let journalData = [];

document.addEventListener('DOMContentLoaded', () => {
    decideSourceAndLoad(); 
    loadJournalFromLocal();
});

async function decideSourceAndLoad() {
    const localCSV = localStorage.getItem('rpg_static_csv');
    if (localCSV) {
        console.log("Carregando de arquivo local salvo...");
        processCSVData(localCSV);
        return;
    }

    const customLink = localStorage.getItem('rpg_custom_link');
    const targetLink = customLink ? customLink : DEFAULT_SHEET;
    
    await fetchDataFromWeb(targetLink);
}

async function fetchDataFromWeb(url) {
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Erro de conexão");
        
        const dataText = await response.text();
        
        if (dataText.includes("<!DOCTYPE") || dataText.includes("<html")) {
            alert("ERRO: O link não é um CSV válido.");
            return;
        }

        processCSVData(dataText);

    } catch (error) {
        console.error(error);
        alert("Erro ao carregar link: " + error.message);
    }
}

function processCSVData(csvText) {
    const db = parseCSV(csvText);
    
    if (!db.info.name && db.arsenal.length === 0) {
        alert("Dados ilegíveis. Verifique a formatação do CSV.");
    }

    loadDataToUI(db);
    initializeRuntimeState(db);
    updateDisplays();
}

function toggleConfig(show) {
    const modal = document.getElementById('config-modal');
    modal.style.display = show ? 'flex' : 'none';
    
    if(show) {
        const currentLink = localStorage.getItem('rpg_custom_link');
        if(currentLink) document.getElementById('cfg-url-input').value = currentLink;
    }
}

function saveUrlConfig() {
    const url = document.getElementById('cfg-url-input').value.trim();
    if (!url) {
        alert("Por favor, insira um link.");
        return;
    }
    
    localStorage.removeItem('rpg_static_csv');
    localStorage.setItem('rpg_custom_link', url);
    
    alert("Link salvo! Recarregando...");
    location.reload();
}

function processFileConfig() {
    const input = document.getElementById('cfg-file-input');
    const file = input.files[0];
    
    if (!file) {
        alert("Selecione um arquivo .csv primeiro.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        
        try {
            localStorage.setItem('rpg_static_csv', content);
            localStorage.removeItem('rpg_custom_link');
            
            alert("Arquivo carregado e salvo na memória! Recarregando...");
            location.reload();
        } catch (err) {
            alert("Arquivo muito grande para salvar no navegador. Tente um arquivo menor.");
        }
    };
    reader.readAsText(file);
}

function resetConfig() {
    if(confirm("Voltar para a planilha original")) {
        localStorage.removeItem('rpg_static_csv');
        localStorage.removeItem('rpg_custom_link');
        location.reload();
    }
}

async function fetchData() {
    try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) throw new Error("Erro de conexão (Rede/Proxy)");
        
        const dataText = await response.text();
        
        if (dataText.includes("<!DOCTYPE") || dataText.includes("<html")) {
            alert("ERRO: O link gerou um site, não um CSV. Verifique se a planilha está publicada como CSV.");
            return;
        }

        const db = parseCSV(dataText);
        
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
    let separator = ',';
    const sample = lines.find(l => l.length > 5);
    if (sample && sample.includes(';')) separator = ';';

    const db = {
        info: {}, 
        attributes: { str:10, dex:10, con:10, int:10, wis:10, cha:10 },
        stats: { maxHp: 0, ac: 0, speed: "", initiative: 0, proficiencyBonus: 2 },
        spells: Array.from({ length: 10 }, () => []),
        spellSlots: Array(10).fill(0), 
        arsenal: [],
        // NOVO: Adicionamos arrays para traços
        traits: { race: [], class: [] },
        companions: { 
            defender: { name: "Defensor", maxHp: 0, texts: {}, traits: [], actions: [], reactions: [] }, 
            homunculus: { name: "Homúnculo", maxHp: 0, texts: {}, traits: [], actions: [], reactions: [] } 
        }
    };

    lines.forEach((row) => {
        if (!row.trim()) return;
        const cols = row.split(separator);
        
        const type = cols[0] ? cols[0].trim().toLowerCase() : "";
        const keyRaw = cols[1] ? cols[1].trim() : ""; 
        const key = keyRaw.toLowerCase();
        
        let name = "";
        let desc = "";

        if (separator === ';') {
            name = cols[2] ? cols[2].trim() : ""; 
            desc = cols[3] ? cols[3].trim() : "";
        } else {
            name = cols[2] ? cols[2].trim() : "";
            desc = cols.slice(3).join(',').trim();
        }
        
        if(type === 'info') { 
            let fullText = desc ? (name + ',' + desc) : name;
            fullText = fullText.replace(/^"|"$/g, '').replace(/""/g, '"');
            db.info[keyRaw] = fullText; 
            if(key === 'name' && fullText === "") db.info.name = desc;
        }

        if(type === 'attr') {
            const val = parseInt(name) || parseInt(desc) || 10;
            db.attributes[key] = val;
        }

        if(type === 'stat') db.stats[key] = (key === 'speed') ? name : parseInt(name);

        if(type.startsWith('spell')) {
            const levelStr = type.replace('spell', '');
            const level = parseInt(levelStr);
            if(!isNaN(level) && level >= 0 && level <= 9 && keyRaw) {
                db.spells[level].push({ name: keyRaw, desc: name });
            }
        }

        if (type === 'slots') {
            const lvl = parseInt(keyRaw); 
            const count = parseInt(name); 
            if (!isNaN(lvl) && !isNaN(count) && lvl >= 0 && lvl <= 9) {
                db.spellSlots[lvl] = count;
            }
        }

        if (type === 'weapon') {
            db.arsenal.push({ 
                name: keyRaw, 
                type: name, 
                isWeapon: true,
                damageDie: desc, 
                bonusAtk: 1 
            });
        }

        if (type === 'tool') {
            db.arsenal.push({ 
                name: keyRaw, 
                desc: name,  
                
                type: "Ferramenta",
                isWeapon: false,
                damageDie: "", 
                bonusAtk: 0 
            });
        }

        if(type === 'trait_race') {
            const txt = cols.slice(2).join(',').trim();
            db.traits.race.push({ title: keyRaw, text: txt });
        }
        if(type === 'trait_class') {
            const txt = cols.slice(2).join(',').trim();
            db.traits.class.push({ title: keyRaw, text: txt });
        }

        if(type.startsWith('pet')) {
            let pet = db.companions[key];
            if(pet) {
                if(type === 'pet') { pet.name = name; pet.maxHp = parseInt(desc) || 0; }
                else if(type === 'pet_txt') { pet.texts[name.toLowerCase()] = desc; }
                else if(type === 'pet_trait') { pet.traits.push({ title: name, text: desc }); }
                else if(type === 'pet_action') { pet.actions.push({ title: name, text: desc }); }
                else if(type === 'pet_reaction') { pet.reactions.push({ title: name, text: desc }); }
            }
        }
    });
    return db;
}

function loadDataToUI(d) {
    if (!d.info.name && !d.info.Name) return; 

    const charName = d.info.name || d.info.Name || "Personagem";

    setText('char-name', charName);
    setText('char-title', d.info.title);
    setText('char-level-display', d.info.level);
    setText('char-race', d.info.race);
    setText('char-class', d.info.classInfo);
    setText('bio-char-languages', d.info.languages);
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
    
    setText('spell-dc', spellDc);
    setText('spell-atk', spellAtk >= 0 ? `+${spellAtk}` : spellAtk);
    setText('prof-bonus', `+${pb}`);
    setText('stat-ac', d.stats.ac);
    setText('stat-init', d.stats.initiative >= 0 ? `+${d.stats.initiative}` : d.stats.initiative);
    setText('stat-speed', d.stats.speed);
    const traitsArea = document.getElementById('traits-injection-area');
    if(traitsArea) traitsArea.innerHTML = ''; 

    renderTraitDrawer('traits-injection-area', d.traits.race, 'Atributos da Raça', 'fa-dna');
    
    renderTraitDrawer('traits-injection-area', d.traits.class, 'Atributos de Classe', 'fa-cogs');

    renderSpellbook(d.spells, d.spellSlots);
    renderArsenal('weapons-container', d.arsenal, spellAtk, intMod);
    renderPetCard('defender', d.companions.defender);
    renderPetCard('homunculus', d.companions.homunculus);
}

function renderSpellbook(allSpells, slotCounts) {
    const container = document.getElementById('spellbook-container');
    if (!container) return;
    container.innerHTML = '';
    

    allSpells.forEach((spells, level) => {
        const slotsNesseNivel = slotCounts[level] || 0;

        if (spells.length > 0 || slotsNesseNivel > 0) {
            
            const isCantrip = level === 0;
            const title = isCantrip ? "Truques (Nível 0)" : `Magias de Nível ${level}`;
            
            const wrapper = document.createElement('div');
            
            const header = document.createElement('div');
            header.className = 'spell-level-header';
            header.innerHTML = `<span>${title}</span> <i class="fas fa-chevron-down"></i>`;
            
            const content = document.createElement('div');
            content.className = 'spell-level-content';
            
            if (!isCantrip && slotsNesseNivel > 0) {
                const slotsDiv = document.createElement('div');
                slotsDiv.className = 'level-slots-header';
                
                let checkboxesHtml = '';
                for(let i = 0; i < slotsNesseNivel; i++) {
                    const storageKey = `slot_lvl${level}_${i}`;
                    
                    const isUsed = localStorage.getItem(storageKey) === 'true';
                    const checkedAttr = isUsed ? 'checked' : '';

                    checkboxesHtml += `
                        <label class="slot-checkbox">
                            <input type="checkbox" ${checkedAttr} onchange="toggleSlot('${storageKey}', this)">
                            <span class="slot-visual"></span>
                        </label>
                    `;
                }

                slotsDiv.innerHTML = `
                    <span>Slots (${slotsNesseNivel})</span>
                    <div class="slots-wrapper">
                        ${checkboxesHtml}
                    </div>
                `;
                content.appendChild(slotsDiv);
            }

            const ul = document.createElement('ul');
            ul.className = 'spell-list';
            
            if (spells.length === 0) {
                 ul.innerHTML = '<li style="color:#666; font-style:italic; padding:10px;">Nenhuma magia preparada.</li>';
            } else {
                spells.forEach(spell => {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${spell.name}</strong><p class="desc">${spell.desc}</p>`;
                    li.onclick = (e) => {
                        e.stopPropagation();
                        li.classList.toggle('active');
                    };
                    ul.appendChild(li);
                });
            }

            content.appendChild(ul);
            wrapper.appendChild(header);
            wrapper.appendChild(content);
            container.appendChild(wrapper);

            header.addEventListener('click', () => {
                header.classList.toggle('active');
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                } else {
                    content.style.maxHeight = (content.scrollHeight + 100) + "px"; 
                }
            });
        }
    });
}

function renderPetCard(petId, petData) {
    const extTitle = document.getElementById(petId === 'defender' ? 'def-name' : 'hom-name');
    if(extTitle) extTitle.innerText = petData.name;

    if(petData.maxHp > 0) appState[petId].max = petData.maxHp;

    const cssClass = petId === 'defender' ? '.steel-defender' : '.homunculus';
    const panel = document.querySelector(`${cssClass}`);
    
    if(!panel) return;

    const txt = petData.texts;
    const ac = txt['ca'] || txt['ac'] || txt['armor class'] || '--';
    const speed = txt['desl'] || txt['desl.'] || txt['speed'] || '--';
    const stats = txt['stats'] || txt['atributos'] || '--'; 
    const skills = txt['pericias'] || txt['skills'] || '';
    const immun = txt['imunes'] || txt['immunities'] || '';
    const senses = txt['sentidos'] || txt['senses'] || '';

    const iconClass = petId === 'defender' ? 'fa-shield-alt' : 'fa-eye';

    let html = ``;
    
    const container = panel.querySelector('.stat-block .stat-content');
    
    if(!container) return;

    container.innerHTML = '';

    let statsHtml = `
        <div class="pet-stats-grid">
            <div class="pet-stat-box">
                <span class="pet-stat-label">Classe de Armadura</span>
                <span class="pet-stat-val">${ac}</span>
            </div>
            <div class="pet-stat-box">
                <span class="pet-stat-label">Deslocamento</span>
                <span class="pet-stat-val">${speed}</span>
            </div>
             <div class="pet-stat-box">
                <span class="pet-stat-label">Tipo</span>
                <span class="pet-stat-val"><i class="fas ${iconClass}"></i></span>
            </div>
        </div>
        
        <div class="pet-stat-box" style="width:100%; margin-bottom: 15px; background: rgba(0,0,0,0.2); padding:5px; border-radius:4px;">
             <span class="pet-stat-label" style="display:block; margin-bottom:2px;">Atributos</span>
             <span style="font-size:0.8rem; color:#aaa;">${stats}</span>
        </div>
    `;

    let detailsHtml = `<div class="pet-details-small">`;
    if(skills) detailsHtml += `<div><strong>Perícias:</strong> ${skills}</div>`;
    if(immun)  detailsHtml += `<div><strong>Imunidades:</strong> ${immun}</div>`;
    if(senses) detailsHtml += `<div><strong>Sentidos:</strong> ${senses}</div>`;
    detailsHtml += `</div>`;

    let actionsHtml = `<div class="pet-actions-section">`;
    if(petData.traits.length > 0) {
        petData.traits.forEach(t => {
            actionsHtml += `<div class="pet-action-item"><strong>${t.title}</strong> ${t.text}</div>`;
        });
    }
    if(petData.actions.length > 0) {
        actionsHtml += `<h5>Ações</h5>`;
        petData.actions.forEach(a => {
            actionsHtml += `<div class="pet-action-item"><strong>${a.title}</strong> ${a.text}</div>`;
        });
    }
    if(petData.reactions.length > 0) {
        actionsHtml += `<h5>Reações</h5>`;
        petData.reactions.forEach(r => {
            actionsHtml += `<div class="pet-action-item"><strong>${r.title}</strong> ${r.text}</div>`;
        });
    }
    actionsHtml += `</div>`;
    container.innerHTML = statsHtml + detailsHtml + actionsHtml;
}

function initializeRuntimeState(d) {
    appState.player.max = d.stats.maxHp || 10;
    appState.defender.max = d.companions.defender.maxHp || 0;
    appState.homunculus.max = d.companions.homunculus.maxHp || 0;

    const savedPlayerHP = localStorage.getItem('hp_player_current');
    if (savedPlayerHP !== null) {
        appState.player.current = parseInt(savedPlayerHP);
    } else {
        appState.player.current = appState.player.max;
    }

    const savedDefenderHP = localStorage.getItem('hp_defender_current');
    if (savedDefenderHP !== null) {
        appState.defender.current = parseInt(savedDefenderHP);
    } else {
        appState.defender.current = appState.defender.max;
    }

    const savedHomunculusHP = localStorage.getItem('hp_homunculus_current');
    if (savedHomunculusHP !== null) {
        appState.homunculus.current = parseInt(savedHomunculusHP);
    } else {
        appState.homunculus.current = appState.homunculus.max;
    }
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
    if (!container) return;
    
    container.innerHTML = '';

    const weapons = list.filter(item => item.isWeapon);
    const tools = list.filter(item => !item.isWeapon);

    let htmlContent = '';

    if (weapons.length > 0) {
        htmlContent += `<h4 class="arsenal-subtitle"><i class="fas fa-swords"></i> Armas</h4>`;
        htmlContent += `<div class="weapons-grid-area">`;

        weapons.forEach(item => {
            const bonus = parseInt(item.bonusAtk) || 0; 
            const hitTotal = spellAtk + bonus;
            const hitDisplay = hitTotal >= 0 ? `+${hitTotal}` : hitTotal;
            
            const dmgBonusTotal = intMod + bonus;
            const dmgDisplay = dmgBonusTotal >= 0 ? `+${dmgBonusTotal}` : dmgBonusTotal;

            let icon = 'fa-gavel';
            const lowerName = item.name.toLowerCase();
            if(lowerName.includes('espada') || lowerName.includes('lâmina')) icon = 'fa-khanda';
            if(lowerName.includes('adaga')) icon = 'fa-dagger';
            if(lowerName.includes('arco') || lowerName.includes('besta')) icon = 'fa-bullseye';
            if(lowerName.includes('lança')) icon = 'fa-pen-nib'; 
            if(lowerName.includes('machado')) icon = 'fa-axe-battle'; 

            htmlContent += `
                <div class="weapon-card">
                    <div class="left-section" style="display:flex; align-items:center;">
                        <div class="weapon-icon-box">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="weapon-info">
                            <span class="weapon-name">${item.name}</span>
                            <span class="weapon-type">${item.type}</span>
                        </div>
                    </div>
                    
                    <div class="weapon-stats-block">
                        <div class="w-stat hit" title="Bônus de Ataque">
                            <span class="w-label">Acerto</span>
                            <span class="w-val">${hitDisplay}</span>
                        </div>
                        <div class="w-stat dmg" title="Dano + Modificador">
                            <span class="w-label">Dano</span>
                            <span class="w-val">${item.damageDie} <span style="font-size:0.7em">${dmgDisplay}</span></span>
                        </div>
                    </div>
                </div>
            `;
        });

        htmlContent += `</div>`; 
    }

    if (tools.length > 0) {
        if (weapons.length > 0) htmlContent += `<div style="height: 20px;"></div>`;
        
        htmlContent += `<h4 class="arsenal-subtitle"><i class="fas fa-toolbox"></i> Equipamentos & Ferramentas</h4>`;
        htmlContent += `<div class="tools-list-area">`;
        
        tools.forEach(item => {
            htmlContent += `
                <div class="tool-item">
                    <i class="fas fa-cogs"></i>
                    <div>
                        <strong>${item.name}</strong> 
                        <span style="color:#777; margin-left:5px;"> — ${item.desc}</span>
                    </div>
                </div>
            `;
        });

        htmlContent += `</div>`;
    }

    // Se não tiver nada
    if (weapons.length === 0 && tools.length === 0) {
        htmlContent = `<p style="color:#666; font-style:italic; text-align:center;">Nenhum equipamento registrado.</p>`;
    }

    container.innerHTML = htmlContent;
}
function updateAttributeDisplay(attr, score) {
    const mod = Math.floor((score - 10) / 2);
    setText(`score-${attr}`, score);
    setText(`mod-${attr}`, mod >= 0 ? `+${mod}` : mod);
}
function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }

function modifyHP(target, amount) {
    const entity = appState[target]; 
    if (!entity) return;

    entity.current += amount;

    if (entity.current > entity.max) entity.current = entity.max;
    if (entity.current < 0) entity.current = 0;

    localStorage.setItem(`hp_${target}_current`, entity.current);

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

function toggleSlot(key, checkbox) {
    if (checkbox.checked) {
        localStorage.setItem(key, 'true');
    } else {
        localStorage.removeItem(key);
    }
}

function toggleJournal(show) {
    const el = document.getElementById('journal-view');
    el.style.display = show ? 'block' : 'none';
    if(show) document.body.style.overflow = 'hidden'; 
    else document.body.style.overflow = 'auto';
}

function addJournalEntry(type) {
    const id = Date.now(); 
    const entry = {
        id: id,
        type: type,
        title: getDefaultTitle(type),
        content: ""
    };
    
    journalData.unshift(entry); 
    renderJournal();
    saveJournalToLocal();
}

function getDefaultTitle(type) {
    switch(type) {
        case 'mission': return 'Missão';
        case 'npc': return 'NPC';
        case 'loot': return 'Item';
        default: return 'Nota';
    }
}

function deleteEntry(id) {
    if(!confirm("Tem certeza que deseja apagar esta anotação?")) return;
    journalData = journalData.filter(e => e.id !== id);
    renderJournal();
    saveJournalToLocal();
}

function updateEntry(id, field, value) {
    const entry = journalData.find(e => e.id === id);
    if(entry) {
        entry[field] = value;
        saveJournalToLocal();
    }
}

function renderJournal() {
    const container = document.getElementById('journal-entries-list');
    container.innerHTML = '';

    if (journalData.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhuma anotação. Adicione algo novo!</p>';
        return;
    }

    journalData.forEach(entry => {
        const div = document.createElement('div');
        div.className = `journal-entry entry-${entry.type}`;

        let icon = 'fa-sticky-note';
        if(entry.type === 'mission') icon = 'fa-scroll';
        if(entry.type === 'npc') icon = 'fa-user';
        if(entry.type === 'loot') icon = 'fa-gem';

        div.innerHTML = `
            <div class="entry-header">
                <div style="display:flex; align-items:center; gap:10px; flex:1;">
                    <i class="fas ${icon}" style="opacity:0.7"></i>
                    <input type="text" class="entry-title" value="${entry.title}" 
                           oninput="updateEntry(${entry.id}, 'title', this.value)" placeholder="Título...">
                </div>
                <button class="btn-delete-entry" onclick="deleteEntry(${entry.id})"><i class="fas fa-trash"></i></button>
            </div>
            <textarea class="entry-body" oninput="updateEntry(${entry.id}, 'content', this.value)" placeholder="Escreva os detalhes aqui...">${entry.content}</textarea>
        `;
        container.appendChild(div);
    });
}

function saveJournalToLocal() {
    localStorage.setItem('rpg_journal_data', JSON.stringify(journalData));
}

function loadJournalFromLocal() {
    const saved = localStorage.getItem('rpg_journal_data');
    if(saved) {
        try {
            journalData = JSON.parse(saved);
            renderJournal();
        } catch(e) { console.error("Erro ao ler LocalStorage", e); }
    }
}

function downloadJournal() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(journalData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "diario_aventura.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function triggerLoadJournal() {
    document.getElementById('journal-upload').click();
}

function loadJournal(input) {
    const file = input.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const loadedData = JSON.parse(e.target.result);
            if(Array.isArray(loadedData)) {
                if(confirm("Isso irá substituir as anotações atuais. Deseja continuar?")) {
                    journalData = loadedData;
                    renderJournal();
                    saveJournalToLocal();
                    alert("Diário carregado com sucesso!");
                }
            } else {
                alert("Formato de JSON inválido.");
            }
        } catch(err) {
            alert("Erro ao ler o arquivo: " + err.message);
        }
    };
    reader.readAsText(file);
    input.value = ''; 
}

function toggleDrawer(header) {
    header.classList.toggle('active');
    const content = header.nextElementSibling;
    
    if (header.classList.contains('active')) {
        content.style.maxHeight = content.scrollHeight + "px";
    } else {
        content.style.maxHeight = null;
    }
}


function renderTraitDrawer(containerId, list, title, iconClass) {
    if (!list || list.length === 0) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'drawer-wrapper'; 

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `<span><i class="fas ${iconClass}"></i> ${title}</span> <i class="fas fa-chevron-down"></i>`;
    
    const content = document.createElement('div');
    content.className = 'drawer-content';

    const ul = document.createElement('ul');
    ul.className = 'drawer-list';

    list.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${item.title}</strong> ${item.text}`;
        ul.appendChild(li);
    });

    content.appendChild(ul);
    wrapper.appendChild(header);
    wrapper.appendChild(content);
    container.appendChild(wrapper);

    header.addEventListener('click', () => {
        header.classList.toggle('active');
        if (content.style.maxHeight) {
            content.style.maxHeight = null;
        } else {
            content.style.maxHeight = (content.scrollHeight + 50) + "px"; 
        }
    });
}