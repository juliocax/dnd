const characterData = {
    // === ABA 1: DADOS GERAIS ===
    info: {
        name: "Torben Magnus",
        title: "Ironflange de Stenberg",
        level: 3,
        race: "Gnomo das Rochas",
        classInfo: "Artífice (Battle Smith)",
        background: "Guild Artisan (Gond)",
        alignment: "Leal e Bom",
        age: "40 Anos",
        heightWeight: "90cm / 23kg",
        appearance: "Homem negro, gola alta seda, avental couro.",
        lore: "Torben Magnus busca redenção. Após plagiar um componente vital para seu Defensor de Aço, a culpa e as dívidas o forçaram a voltar para sua loja. Agora, ele treina sua sobrinha Linnea e busca provar seu valor genuíno."
    },
    // Atributos Puros (O script calculará os modificadores)
    attributes: {
        str: 10,
        dex: 10,
        con: 10,
        int: 16, // Exemplo: Alterei para 16 para você ver a mudança na ficha
        wis: 10,
        cha: 10
    },
    stats: {
        maxHp: 21, // Valor fixo vindo da planilha
        ac: 16,
        speed: "7.5m",
        initiative: 0,
        proficiencyBonus: 2 // Você pode automatizar ou deixar manual na planilha
    },
    companions: {
        defender: { name: "Defensor de Aço", maxHp: 20, ac: 15, stats: "FOR 14, DES 12, CON 14, INT 4, SAB 10" },
        homunculus: { name: "Homúnculo", maxHp: 10, ac: 13, stats: "FOR 4, DES 15, CON 12, INT 10, SAB 10" }
    },

    // === ABA 2: MAGIAS ===
    spells: {
        cantrips: [
            { name: "Mending", desc: "Repara quebras ou fissuras em objetos. 1 minuto." },
            { name: "Fire Bolt", desc: "1d10 Fogo (36m)." },
            { name: "Guidance", desc: "+1d4 em Teste de Habilidade." }
        ],
        level1: [
            { name: "Shield", desc: "Reação, +5 na CA até o início do próximo turno." },
            { name: "Cure Wounds", desc: "1d8 + Int de Cura (Toque)." },
            { name: "Heroism", desc: "Imune a medo, ganha HP temporário igual mod. atributo." },
            { name: "Detect Magic", desc: "Ritual. Detecta auras mágicas a 9m." },
            { name: "Identify", desc: "Ritual. Identifica propriedades de itens mágicos." },
            { name: "Grease", desc: "Área escorregadia 3m quadrado. DEX save ou cai." }
        ]
    },

    // === ABA 3: ARMAS E FERRAMENTAS ===
    arsenal: [
        { 
            name: "Martelo de Batalha (Infundido)", 
            type: "Mágico • +1 Atk/Dano", 
            isWeapon: true,
            bonusAtk: 1, // Bônus da arma em si
            damageDie: "1d8",
            damageType: "Concussão"
        },
        { name: "Ferramentas de Ladrão", type: "Perícia", isWeapon: false, desc: "Abertura de fechaduras e armadilhas." },
        { name: "Ferramentas de Latoeiro", type: "Perícia", isWeapon: false, desc: "Reparos diversos." },
        { name: "Ferramentas de Ferreiro", type: "Perícia", isWeapon: false, desc: "Trabalho em metal." }
    ]
};