// DADOS DO PERSONAGEM
const stats = {
    level: 3,
    attributes: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10, // Importante: Se quiser mudar na ficha, mude aqui. Ex: int: 16 (+3)
        wis: 10,
        cha: 10
    },
    player: {
        maxHp: 18,
        currentHp: 18
    },
    defender: { currentHp: 0, maxHp: 0 },
    homunculus: { currentHp: 0, maxHp: 0 }
};

document.addEventListener('DOMContentLoaded', () => {
    updateAll();
});

function updateAll() {
    updateAttributes();
    updateCompanionsStats();
    updateCombatStats();
    updateDisplays();
}

// 1. ATUALIZA ATRIBUTOS NA TELA
function updateAttributes() {
    const getMod = (score) => Math.floor((score - 10) / 2);
    for (const [key, value] of Object.entries(stats.attributes)) {
        const mod = getMod(value);
        document.getElementById(`score-${key}`).innerText = value;
        document.getElementById(`mod-${key}`).innerText = mod >= 0 ? `+${mod}` : mod;
    }
}

// 2. CALCULA ESTATISTICAS DE COMBATE E TEXTOS DINAMICOS
function updateCombatStats() {
    // Proficiency Bonus: Nvl 1-4 (+2), 5-8 (+3), 9-12 (+4), 13-16 (+5), 17-20 (+6)
    const pb = Math.ceil(stats.level / 4) + 1;
    const intMod = Math.floor((stats.attributes.int - 10) / 2);
    
    // Spell Attack = Int Mod + PB
    const spellAtk = intMod + pb;
    const spellDc = 8 + intMod + pb;

    // Atualiza Painel Principal
    document.getElementById('prof-bonus').innerText = `+${pb}`;
    document.getElementById('spell-atk').innerText = spellAtk >= 0 ? `+${spellAtk}` : spellAtk;
    document.getElementById('spell-dc').innerText = spellDc;

    // Atualiza Arma (Battle Ready: Usa INT para ataque e dano com arma mágica)
    // Assumindo Arma Infundida (+1)
    const weaponHit = spellAtk + 1; 
    document.getElementById('weapon-hit-val').innerText = `+${weaponHit}`;

    // Atualiza Textos Dinâmicos nas Fichas dos Pets e Arma
    // Classe .dyn-pb -> Valor do PB
    document.querySelectorAll('.dyn-pb').forEach(el => el.innerText = pb);
    // Classe .dyn-spell-atk -> Valor do Ataque Magico
    document.querySelectorAll('.dyn-spell-atk').forEach(el => el.innerText = spellAtk >= 0 ? `+${spellAtk}` : spellAtk);
    // Classe .dyn-int-plus-one -> Dano da arma (Int + 1)
    document.querySelectorAll('.dyn-int-plus-one').forEach(el => el.innerText = (intMod + 1));
    // Classe .calc-pp-defender -> Passive Perception (10 + PB*2)
    document.querySelectorAll('.calc-pp-defender').forEach(el => el.innerText = (10 + (pb * 2)));
}

// 3. CALCULA VIDA DOS PETS
function updateCompanionsStats() {
    const intMod = Math.floor((stats.attributes.int - 10) / 2);
    
    // Steel Defender: HP = 2 + IntMod + (5 * Level)
    const defMax = 2 + intMod + (5 * stats.level);
    stats.defender.maxHp = defMax;
    if(stats.defender.currentHp === 0 || stats.defender.currentHp > defMax) stats.defender.currentHp = defMax;

    // Homunculus: HP = 1 + IntMod + Level
    const homMax = 1 + intMod + stats.level;
    stats.homunculus.maxHp = homMax;
    if(stats.homunculus.currentHp === 0 || stats.homunculus.currentHp > homMax) stats.homunculus.currentHp = homMax;
}

// 4. ATUALIZA BARRAS E NÚMEROS
function updateDisplays() {
    // Player
    document.getElementById('current-hp').innerText = stats.player.currentHp;
    document.getElementById('max-hp').innerText = stats.player.maxHp;
    updateBarColorAndSize('hp-bar', stats.player.currentHp, stats.player.maxHp);
    
    // Level
    document.getElementById('level-val').innerText = stats.level;
    document.getElementById('char-level-display').innerText = stats.level;
    document.getElementById('footer-lvl').innerText = stats.level;

    // Defender
    document.getElementById('defender-hp-text').innerText = `${stats.defender.currentHp}/${stats.defender.maxHp}`;
    updateBarColorAndSize('defender-hp-bar', stats.defender.currentHp, stats.defender.maxHp);

    // Homunculus
    document.getElementById('homunculus-hp-text').innerText = `${stats.homunculus.currentHp}/${stats.homunculus.maxHp}`;
    updateBarColorAndSize('homunculus-hp-bar', stats.homunculus.currentHp, stats.homunculus.maxHp);
}

// Auxiliar: Cor da Barra (Verde -> Amarelo -> Vermelho)
function updateBarColorAndSize(elementId, current, max) {
    const percent = Math.max(0, Math.min(100, (current / max) * 100));
    const bar = document.getElementById(elementId);
    bar.style.width = `${percent}%`;
    const hue = Math.floor(percent * 1.2); 
    bar.style.backgroundColor = `hsl(${hue}, 100%, 40%)`;
    bar.style.boxShadow = `0 0 10px hsl(${hue}, 100%, 40%)`;
}

function modifyHP(target, amount) {
    const entity = stats[target];
    entity.currentHp += amount;
    if (entity.currentHp > entity.maxHp) entity.currentHp = entity.maxHp;
    if (entity.currentHp < 0) entity.currentHp = 0;
    updateDisplays();
}

function changeLevel(amount) {
    stats.level += amount;
    if(stats.level < 1) stats.level = 1;
    if(stats.level > 20) stats.level = 20;

    // Ajusta HP Max Player (Regra genérica: +5 +CON)
    const conMod = Math.floor((stats.attributes.con - 10) / 2);
    const hpPerLevel = 5 + conMod;

    if (amount > 0) {
        stats.player.maxHp += hpPerLevel;
        stats.player.currentHp += hpPerLevel;
    } else {
        stats.player.maxHp -= hpPerLevel;
        if(stats.player.currentHp > stats.player.maxHp) stats.player.currentHp = stats.player.maxHp;
    }
    updateAll();
}

function toggleDesc(element) {
    element.classList.toggle('active');
}