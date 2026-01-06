
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
        
        if(type === 'info') { db.info[keyRaw] = name; if(key === 'name' && name === "") db.info.name = desc; }
        
        // --- CORREÇÃO AQUI (Lê atributo da col C ou D) ---
        if(type === 'attr') {
            // Tenta ler o número da coluna C (name), se falhar, tenta da D (desc)
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
            const count = parseInt(name); // Slots precisam estar na Coluna C (Name)
            
            if (!isNaN(lvl) && !isNaN(count) && lvl >= 0 && lvl <= 9) {
                db.spellSlots[lvl] = count;
            }
        }

        // ... resto do código (weapon, pet) continua igual ...
        if(type === 'weapon') {
            const isWpn = desc.toLowerCase().includes('d');
            db.arsenal.push({ name: keyRaw, type: name, isWeapon: isWpn, damageDie: desc, bonusAtk: 1 });
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
    
    // Atualiza Displays de Magia
    setText('spell-dc', spellDc);
    setText('spell-atk', spellAtk >= 0 ? `+${spellAtk}` : spellAtk);
    setText('prof-bonus', `+${pb}`);
    setText('stat-ac', d.stats.ac);
    setText('stat-init', d.stats.initiative >= 0 ? `+${d.stats.initiative}` : d.stats.initiative);
    setText('stat-speed', d.stats.speed);

    // --- CORREÇÃO AQUI (Passando d.spellSlots) ---
    renderSpellbook(d.spells, d.spellSlots);
    
    renderArsenal('weapons-container', d.arsenal, spellAtk, intMod);
    renderPetCard('defender', d.companions.defender);
    renderPetCard('homunculus', d.companions.homunculus);
}

function renderSpellbook(allSpells, slotCounts) {
    const container = document.getElementById('spellbook-container');
    if (!container) return;
    container.innerHTML = '';
    
    // REMOVIDO: const SLOTS_CONFIG = [...]  <- Isso estava forçando os valores errados

    allSpells.forEach((spells, level) => {
        // Pega a quantidade vinda da planilha. Se não tiver nada, é 0.
        const slotsNesseNivel = slotCounts[level] || 0;

        // Renderiza se tiver magia OU se tiver slots definidos
        if (spells.length > 0 || slotsNesseNivel > 0) {
            
            const isCantrip = level === 0;
            const title = isCantrip ? "Truques (Nível 0)" : `Magias de Nível ${level}`;
            
            const wrapper = document.createElement('div');
            
            const header = document.createElement('div');
            header.className = 'spell-level-header';
            header.innerHTML = `<span>${title}</span> <i class="fas fa-chevron-down"></i>`;
            
            const content = document.createElement('div');
            content.className = 'spell-level-content';
            
            // Gera os slots baseados no número da planilha
            if (!isCantrip && slotsNesseNivel > 0) {
                const slotsDiv = document.createElement('div');
                slotsDiv.className = 'level-slots-header';
                
                let checkboxesHtml = '';
                for(let i=0; i < slotsNesseNivel; i++) {
                    checkboxesHtml += `
                        <label class="slot-checkbox">
                            <input type="checkbox">
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
                    content.style.maxHeight = (content.scrollHeight + 50) + "px"; 
                }
            });
        }
    });
}

function renderPetCard(petId, petData) {
    // Atualiza nome no título (se houver elemento externo)
    // Nota: O novo layout renderiza o nome DENTRO do card, mas mantemos o update externo por segurança
    const extTitle = document.getElementById(petId === 'defender' ? 'def-name' : 'hom-name');
    if(extTitle) extTitle.innerText = petData.name;

    if(petData.maxHp > 0) appState[petId].max = petData.maxHp;

    const cssClass = petId === 'defender' ? '.steel-defender' : '.homunculus';
    const panel = document.querySelector(`${cssClass}`);
    
    if(!panel) return;

    // Dados de texto
    const txt = petData.texts;
    const ac = txt['ca'] || txt['ac'] || txt['armor class'] || '--';
    const speed = txt['desl'] || txt['desl.'] || txt['speed'] || '--';
    const stats = txt['stats'] || txt['atributos'] || '--'; // ex: "FOR 14 (+2) ..."
    const skills = txt['pericias'] || txt['skills'] || '';
    const immun = txt['imunes'] || txt['immunities'] || '';
    const senses = txt['sentidos'] || txt['senses'] || '';

    // Ícone baseado no tipo para dar um charme
    const iconClass = petId === 'defender' ? 'fa-shield-alt' : 'fa-eye';

    // Montagem do HTML Novo
    let html = ``;

    // 1. HEADER (Imagem + Título) - A imagem deve estar no HTML, mas vamos reorganizar ou assumir que ela existe.
    // Para simplificar e garantir que fique bonito, vamos injetar a estrutura completa dentro do Painel,
    // exceto o título H3 original que a gente esconde via CSS ou substitui.
    
    // Vamos reconstruir o conteúdo interno do painel preservando a imagem original se possível, 
    // ou apenas injetando o HTML do corpo.
    // Estratégia: Vamos substituir o innerHTML de um container específico ou criar um novo.
    
    // Como o seu HTML tem uma estrutura fixa, vamos focar em preencher o .stat-content 
    // E mover a imagem/barra de vida para o lugar certo visualmente.
    
    // Para ficar MUITO bonito, vou sugerir que você altere o HTML do container stats,
    // mas aqui via JS vou gerar o bloco de "Dados do Monstro".
    
    const container = panel.querySelector('.stat-block .stat-content');
    
    // Se não achar o container padrão, aborta
    if(!container) return;

    // Limpa container antigo
    container.innerHTML = '';

    // --- BLOCO DE STATUS (GRID) ---
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

    // --- DETALHES MENORES ---
    let detailsHtml = `<div class="pet-details-small">`;
    if(skills) detailsHtml += `<div><strong>Perícias:</strong> ${skills}</div>`;
    if(immun)  detailsHtml += `<div><strong>Imunidades:</strong> ${immun}</div>`;
    if(senses) detailsHtml += `<div><strong>Sentidos:</strong> ${senses}</div>`;
    detailsHtml += `</div>`;

    // --- AÇÕES & TRAÇOS ---
    let actionsHtml = `<div class="pet-actions-section">`;

    // Traços
    if(petData.traits.length > 0) {
        petData.traits.forEach(t => {
            actionsHtml += `<div class="pet-action-item"><strong>${t.title}</strong> ${t.text}</div>`;
        });
    }

    // Ações
    if(petData.actions.length > 0) {
        actionsHtml += `<h5>Ações</h5>`;
        petData.actions.forEach(a => {
            actionsHtml += `<div class="pet-action-item"><strong>${a.title}</strong> ${a.text}</div>`;
        });
    }

    // Reações
    if(petData.reactions.length > 0) {
        actionsHtml += `<h5>Reações</h5>`;
        petData.reactions.forEach(r => {
            actionsHtml += `<div class="pet-action-item"><strong>${r.title}</strong> ${r.text}</div>`;
        });
    }
    actionsHtml += `</div>`;

    // Renderiza tudo
    container.innerHTML = statsHtml + detailsHtml + actionsHtml;
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