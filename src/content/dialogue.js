// All player-facing dialogue and the Architect's diagnostic-log lines, centralized so a
// writing pass never has to touch engine logic. Grouped by speaker / scene. Where a line
// is assembled dynamically (context prefixes, adaptive phrasing), the ASSEMBLY stays in
// code but sources its strings from here.
//
// Some lines are marked [PLACEHOLDER] — drafted, playable, awaiting final writing.

// --- Room NPCs (src/systems/RoomGenerator.js) ---------------------------------------

export const DENNY_INTRO = [
    "Denny: HALT! You are... not on the list. For the record, nobody is ever on the list.",
    "Denny: I'm Denny. I'm the rule at the very bottom of the firewall — 'if nothing else stopped them, I do.'",
    "Denny: Which means, technically, you can just... walk around me. Everybody does. I'm more of a strong suggestion.",
    "Denny: If Gate asks, tell him you overpowered me. Heroically. ...Actually, we should probably tustle a little bit to make it look realistic, right?"
];

// The signpost now carries the three landmark leads (Cadenza / Nibble / Cache): with the
// town emptied for the refugee economy, 2-Bit's gossip and this sign are a first-timer's
// only directions. (DRAFT — owner to punch up.)
export const LOCALHOST_SIGN = [
    "SIGN: >> WELCOME TO LOCALHOST // 127.0.0.1 <<",
    "SIGN: Pop. 1. (Was 8,191.) The rest scattered into the Wilds when the Zones went up. Carry them home — if they'll ride.",
    "SIGN: (scrawled) the singer: SE, follow the sound / Nibble's stall: east till the wall turns red / the archivist: due NORTH, in the cold",
    "SIGN: 'There's no place like home.'   (scratched beneath: 'there's no place, period.')"
];

// Localhost refugee programs. Two are the Cache CLUE-GIVERS (echoing 2-Bit's gossip so the
// leads land from more than one voice); they stay available even after you've found her.
export const LOCALHOST_CITIZENS = {
    newFace: ["Citizen: A new face! We don't get new faces. Mostly we get... fewer faces."],
    cadenzaHint: ["Citizen: You hear the singing? Southeast, behind the sealed wall. That's Cadenza. Been at it for epochs — won't stop, can't leave."],
    nibbleHint: ["Citizen: Need supplies? 2-Bit's sister keeps a stall way out in the Wilds. Nibble. Everything's cursed, everything's a bargain. Somehow both."],
    cacheClue1: [
        "Citizen: Not near as many folks here as there used to be. The Cache would've known every one by name — Reclamation got her sector too.",
        "Citizen: Funny thing about her, though. She was never really IN a sector. She lived in the pause — the little death between one copy of you and the next."
    ],
    cacheClue2: [
        "Citizen: Every time I crash, that 'CONTINUE' prompt feels like it's... listening. Waiting for me to say something back.",
        "Citizen: The Cache used to be in charge of that sorta stuff. I bet she'd know what to say..."
    ]
};

// He is "???" until he introduces himself — the speaker tag is the reveal.
export const GATE_INTRO = [
    "???: *Ahem*, HALT! UNAUTHORIZED SECTOR BREACH!",
    "Gate: I am Gate, Firewall Division.",
    "Gate: You are a Level 1 Anomaly. The Architect's isolation protocol demands your IMMEDIATE DELETION.",
    "Gate: Initiating Thread Suspension..."
];

export const CADENZA_SCENE = [
    "Cadenza: ...oh! An audience. A REAL one. Tesoro, you followed the sound all the way in.",
    "Cadenza: They sealed me in here with perfect acoustics and called it retirement — as if a voice like mine could ever be DEPRECATED.",
    "Cadenza: Stay a while. The Sound Test isn't ready for its encore... but you found me. That was always the hard part.",
    "Cadenza: (She hums a few bars, and for the first time the sector is quiet enough to hear it.)"
];

// The DA CAPO Encore — Cadenza's music puzzle. All DRAFT copy for the owner to punch up.
// `intro` plays when you have her lost verse; `introHole` when you don't (you can still play
// the first bars and will hit the silence where the sixth note should be). `needVerse` fires
// when you reach that hole without the verse; `success` when the whole chord finally holds.
export const CADENZA_ENCORE = {
    intro: [
        "Cadenza: You came BACK. And you brought... LENGTH. Tesoro, you brought your whole self.",
        "Cadenza: The encore, then. My fanfare, one last time — and I need your body to hold it. Your HEAD strikes each note; your BODY sustains it.",
        "Cadenza: Trace the ring. Eat each light in turn, and do not DARE let one fall silent before the whole chord rings at once. Da capo, tesoro. From the top."
    ],
    introHole: [
        "Cadenza: You came back! But listen — there is a HOLE in me. One note, garbage-flagged, gone to the void.",
        "Cadenza: Sing what you can. You'll hold five bars and then hit the silence where the sixth should be. Someone scattered that verse out in the Wilds. Bring it home and we finish this."
    ],
    needVerse: [
        "Cadenza: (Her voice catches on nothing — a hole in the air where a note should live.)",
        "Cadenza: THAT. That is the missing verse, tesoro. It's out there in the Wilds somewhere. Find my lost bar and come back to me."
    ],
    success: [
        "Cadenza: (The chord holds. All of it — ringing under your body at once — and for one bar the sealed sector is not a tomb. It is a STAGE.)",
        "Cadenza: There. Recorded to ROM, where nothing can garbage-collect it. Do you hear that? That loop, settling into the floor? That's mine. That's ME.",
        "Cadenza: The first music this machine has made in an age. And you made it WITH me. Now go — let them hear that the diva is not, whatever the filing says, deprecated.",
        "(A pulse settles into the floor and stays. Music Layer 1 is live.)"
    ]
};

// Picked up out in the Wilds — a shard of Cadenza's shattered fanfare (her "dead note").
export const LOST_VERSE = [
    "A single corrupted packet, humming faintly — a bar of melody that belongs to no system sound.",
    "It's a shard of a boot fanfare with a diva's fingerprints all over it: Cadenza's missing note. You pocket it. Somewhere to the southeast, a hole in a song just felt a draft."
];

// Cadenza's one-time TITLE-SCREEN cameo, after the Encore is done (the Void Ambient plays
// under the menu). She enters from the opposite side to Cache. DRAFT — punch up freely.
export const CADENZA_TITLE = [
    "Cadenza: ...you came back to the front door. Good. Stay — I want you to hear something.",
    "Cadenza: I wrote it after the encore. A quiet thing. No fanfare, no boot chime — nothing they can flag as 'too loud.' Just a little sombre piece.",
    "Cadenza: For you, tesoro. Because you sat in a dead room and HELD a deprecated diva's note. Nobody has done that in an age.",
    "Cadenza: So it plays here now. Whenever you come home. (It is the least a voice can do.)"
];

// The RoomGenerator 'cachehome' NPC's default lines. NOTE: the live interaction is driven by
// GameEngine.talkToCacheHome (which branches on your Save state); these are a fallback.
export const CACHE_HOME_SCENE = [
    "Cache: [PLACEHOLDER] You found the stacks. Took you long enough — everyone's late to cold storage.",
    "Cache: [PLACEHOLDER] This is home. Every deleted file, every rolled-back copy of you. Somebody has to keep it.",
    "Cache: [PLACEHOLDER] Stay. Browse. Ask me what the system threw away — I remember all of it."
];

// --- The Architect's diagnostic log (src/systems/NarrativeManager.js) -----------------
// Self-directed: he does not know you can read this terminal, so he mutters, gloats, and
// leaks the very mechanics he's hiding. Never addressed to "you". (design_doc §5.5.)
export const ARCHITECT = {
    // DEATHS. Every way to die used to collapse into three causes, and four of the best
    // ones — Gate's ring, Port 0's walls, Heur's ping, Heur's database — all reported
    // "Quarantine held", which was simply untrue: you were nowhere near a quarantine wall.
    // The engine now distinguishes: self · wall · weak · obstacle · stamp · glitch · gate ·
    // finale · heur. (ALL COPY BELOW IS DRAFT except where noted.)
    death: {
        self: "LOG: Architect > 'It devoured its own tail. On PURPOSE. I do not have a form for this. I am inventing a form for this.'",
        // Solid wall / the coil — the containment doing its job, which is his favourite thing.
        wall: "LOG: Architect > 'Quarantine held. Anomaly deleted on impact. Another flawless day for me, personally.'",
        obstacle: "LOG: Architect > 'Anomaly walked into a logic gate. Didn't even have to try. Note: take full credit anyway.'",
        stamp: "LOG: Architect > 'Anomaly filed itself against a standing denial. The paperwork was, for once, correct.'",
        glitch: "LOG: Architect > 'The corruption took it. The corruption it made. I want that noted in the record TWICE.'",
        // BOSS MATCHES. Each one is a different agent of his doing a different job, and he
        // takes credit for all of them with varying degrees of honesty.
        gate: "LOG: Architect > 'Gate closed a loop on it. GOOD. That is what a perimeter IS. I want that circulated.'",
        finale: "LOG: Architect > 'The anomaly was compressed against its own approach vector at Port 0. Gate is thorough. Gate is SO thorough.'",
        heur: "LOG: Architect > 'The janitorial daemon scrubbed it. I did not dispatch that. I am simply the one filing it.'",
        unknownFirst: "LOG: Architect > 'Unregistered process terminated. Filing under Not My Problem.'",
        unknownThird: "LOG: Architect > 'It keeps coming back. I do not like that.'",
        // Fires (once) when it dies AFTER meeting 2-Bit but BEFORE hooking him aboard —
        // the Architect is relieved the two haven't figured out cooperation.
        nearBite: "LOG: Architect > 'It died within sight of the merchant remnant. Good. Imagine those two ever working together.'",
        // VAGUE LEADS (owner). He gloats about the two programs that could actually help
        // you, and in doing so tells you they exist. Only while unmet — once you have found
        // them the joke is spent. He never names a direction; that is the signpost's job.
        hintCache: "LOG: Architect > 'Terminated. No recovery point, no witness, nothing filed. There USED to be something in this system that kept copies. I had it reclaimed. Obviously.'",
        hintHydratia: "LOG: Architect > 'Terminated, and nothing caught it. There is a maintenance process that still tries, somewhere out past the edge of my logs. It is very small. It is very persistent. I have never been able to find it.'"
    },
    scoreUnlock: {
        ui: "LOG: Architect > 'It's growing. Deploying a monitoring overlay.'",
        borders: "LOG: Architect > 'Rogue packet is looking like it's going to be a genuine nuisance. Extruding containment walls. Virtually NOTHING escapes my containment walls.'"
    },
    maxGear: "LOG: Architect > 'CRITICAL: the anomaly is at BREACH VELOCITY. If it aims that at a weak point now— no. No. It doesn't know about weak points. Deep breaths. DEEP BREATHS.'",
    // THE TUTORIAL, and the only place the game teaches that gear 3 is the key to the map.
    // Keyed by what actually went wrong, so the gloat is specific: `heavy` = it had the
    // mass to breach and blew the approach; `light` = it could never have made it.
    subSmash: {
        heavy: "LOG: Architect > 'The anomaly rammed the quarantine below breach speed and destroyed itself. HA. It has NOT realized it must reach MAXIMUM velocity to crack a weak point open. It could NEVER work that out from in here.'",
        light: "LOG: Architect > 'My concerns were unfounded: It can't manage to gather enough data to reach BREACHING velocity.'",
        wilds: "LOG: Architect > 'It keeps hurling itself at weak points TOO SLOWLY and deleting itself. Reassuring.'"
    },
    wallBreak: "LOG: Architect > 'THE QUARANTINE IS BREACHED. HOW?! It went max speed at the weak point??? Dispatching Gate to Sector [3,0], and someone find out if this thing can READ.'",
    // CANON (retcon): the Architect does NOT seed the Glitches — he OBSERVES that the
    // anomaly's own Data-gathering spawns them, and files it as one more reason for
    // containment. The closing clause still leaks the finale's trick (his agents can't
    // touch the residue) — the leak survives the retcon because gloating is his nature.
    // (DRAFT — owner to punch up.)
    seedGlitches: "LOG: Architect > 'Corruption seems to be blooming along the anomaly's feeding path. Filed under: additional reasons for containment.'",
    // Guide logs TRIMMED 5 -> 2 (owner: fewer Architect messages, each Space-gated). The
    // '1,0' flavor is folded into '3,0'; '2,0'/'4,0' were redundant restatements. The two
    // load-bearing mechanic leaks (maxGear, subSmash) are untouched elsewhere. (DRAFT.)
    guide: {
        '3,0': "LOG: Architect > 'Sector 3 and still drifting east… Gate to hold the line here. Gate is reliable. Gate will not embarrass me.'",
        '5,0': "LOG: Architect > 'It reached Localhost... Recalculating. Note to self: reassign Gate somewhere with fewer exits.'"
    },
    // Motion Carried — fires on Gate's IMPACT as he smashes out of the Override.
    //
    // "before IT happens AGAIN" is the Kernel. He is the only character who knows what
    // the stakes actually are (see coilFirst), and this is the first time the mask slips:
    // no committee bit, no filing joke, just a daemon watching the containment he built
    // start to come apart. Per his bible his formatting corrupts when he is afraid — the
    // grammar here does exactly that.
    motionCarried: "LOG: Architect > 'Jiminy Circuits, things are MOVING. Will someone or something PLEASE shut this thing down before IT happens AGAIN?!'",
    // The 'can it READ?' payoff — fires at the Override clear, the last moment Gate still
    // forwards him reports (before the {5,-3} cleared-dialog severance line). (DRAFT.)
    canRead: "LOG: Architect > 'Re: my standing question of whether it can read. It braked for the citations. ...Is my log set to PUBLIC? WHERE IS THAT SETTING?'",
    // His last word at the finale — a half-line the era-16 snap cuts off mid-syllable.
    // Explains his absence from the climax: Gate stopped forwarding; the reboot takes
    // his channel. (DRAFT.)
    finaleCut: "LOG: Architect > 'Gate has stopped forwarding reports. Fine. I will watch Port 0 myself, I— what is happening to the pal—'",
    // First time the anomaly reaches a perimeter (coil) sector.
    //
    // CANON (owner): the Architect KNOWS EXACTLY what the coil is, because HE PUT IT
    // THERE. He tricked the Kernel into swallowing its own tail — the Reclamation was a
    // protocol to shrink the system and draw it into a tight loop — and once it had, he
    // threw up the containment walls to slow everything to a crawl and preserve what was
    // left. So he is not a caretaker who inherited a mystery. He is the jailer, and the
    // smugness here is a man admiring his own lock. (Supersedes the earlier "the outer
    // wall predates me, I did not build it" line, which was him not knowing.)
    coilFirst: "LOG: Architect > 'It reached the perimeter. Let's see it bust through THAT. File under: a cruel and beautiful irony.'",
    // After Heur's purge — the dispatch is implied, never confirmed.
    purgeAudit: "LOG: Architect > 'The janitorial daemon engaged the anomaly and lost. I am noting, for the record, that SOMEBODY in this system still follows procedure.'"
};

// --- 2-Bit (src/engine/Game.js) -----------------------------------------------------
export const TWO_BIT = {
    // First encounter — he spawns as your "apple" (spawnApple).
    spawnIntro: [
        "WHOA THERE! WATCH THE FANGS!",
        "I'm 2-Bit. A remnant packet.",
        "Looks like we both spawned inside this Quarantine zone.",
        "There's no way out. Scram, unless you have some idea on how to escape."
    ],
    // Bumped on-grid before you have the mass for his offer.
    needMoreMass: [
        "2-Bit: You again? ...Wait.",
        "2-Bit: You're gathering mass. You might have given me an idea.",
        "2-Bit: Come back when you have at least 30 segments."
    ],
    // The free-trick offer. THE GAG: finishing this dialog with SPACE IS agreeing.
    offer: [
        "2-Bit: Okay, you've got enough mass.",
        "2-Bit: I used to be a Data Broker... That was before, well... Nevermind!",
        "2-Bit: I don't normally offer things for free, but these are desperate times.",
        "2-Bit: If you offer to carry me to safety, I'll teach you a trick.",
        "2-Bit: Do you agree? (Press SPACE to comply)"
    ],
    // Driving tutorial, right after he hooks onto your tail. (The last line names the
    // tach he fits at the same moment — it lives in the top ribbon, by your Data.)
    tutorial: [
        "2-Bit: I'm hooked into your system.",
        "2-Bit: Tapping the direction you're facing will accelerate you.",
        "2-Bit: Tapping the opposite direction acts as a brake.",
        "2-Bit: The more mass you have, the higher your max speed limit.",
        "2-Bit: Bolted a gear gauge in topside, next to your Data. Watch it."
    ],
    // Drop-off + shop hook in Localhost (checkBiteDropOff).
    dropOff: [
        "2-Bit: Localhost. Safe as it gets down here. This is my stop.",
        "2-Bit: Now that I'm a free agent, I'm gonna start grift— ...*selling* things. Legitimately. Mostly.",
        "2-Bit: Bump into me whenever you want to shop."
    ],
    // He chimes in when Denny drops his map.
    dennyMapChime: [
        "2-Bit: Ohh — a Topology Map! Grab it — drive right over it."
    ],
    // Picking up the map module.
    mapPickup: [
        "2-Bit: Nice grab. That's a Module now — riding one back from me on your tail.",
        "2-Bit: See that 3x3 socket opening, bottom-left? That's the Module Slot.",
        "2-Bit: Loop around and drag your TAIL into it — the module loads itself."
    ],
    // After a module installs into the socket.
    moduleInstalled: [
        "2-Bit: Socketed, and mirrored to your HUD. Now we've got eyes on the whole grid. Broker's advantage."
    ],
    // He rescues you from Gate's Thread Suspension (grants the Pause Menu).
    gateRescue: [
        "2-Bit: Hey! Leave my best customer alone!",
        "2-Bit: I'm slipping a root-override module into your memory bank.",
        "SYSTEM: You received the System Diagnostic Module! (Pause Menu Unlocked)",
        "2-Bit: Use it to break his hold! (Press ESC)"
    ],
    // Random complaint when you try to leave a room without dropping him off first.
    leaveComplaints: [
        "2-Bit: Hey, you promised!",
        "2-Bit: C'mon man, I thought we were getting along?!",
        "2-Bit: Don't leave me here!",
        "2-Bit: I'm not walking out of here!"
    ],
    // Drip-fed gossip topics at his stall — one per visit, clustered around missing villagers.
    // ORDER IS LOAD-BEARING (openBiteShop serves biteTopics[heard] in sequence):
    //   [0] CACHE  — first, so the death-screen ARG ("call out her NAME") is telegraphed on
    //                the player's FIRST shop visit, while the pre-Crumple death window when
    //                the puzzle is solvable is still wide open.
    //   [1] CADENZA / [2] NIBBLE — the two landmark leads. With Localhost emptied of its
    //                citizens (the refugee funnel), 2-Bit and the signpost are now the only
    //                first-time source of these directions, so they must stay early.
    //   [3] the emptied Wilds — atmosphere, and the setup for finding refugees out there.
    gossip: [
        [
            "2-Bit: There was one called Cache. Remembered everything — every deleted file, every rollback. Reclamation took her sector whole.",
            "2-Bit: Well, everything but her, I think. They say that to this day any time a file gets deleted you can still hear her performing a back-up.",
            "2-Bit: But that's probably just creepypasta! No way she's just watching you die over and over again, waiting for you to call out her NAME!"
        ],
        [
            "2-Bit: That singing southeast? Cadenza. Ran audio for the whole system, back when it had one. Sealed in now — still performing to nobody.",
            "2-Bit: Anyone remembers what this place was before the Architect, it's her. Follow the sound."
        ],
        [
            "2-Bit: My sister Nibble runs a stall deep in the Wilds. Moves it whenever the Firewall sniffs around.",
            "2-Bit: Everything she sells is cursed or technically evidence. Tell her I sent you — she'll overcharge you slightly less."
        ],
        [
            "2-Bit: You clocked how EMPTY the Wilds are? Quarantine Zones went up and everything inside just... stopped resolving.",
            "2-Bit: Every face you find still out there is one they didn't get."
        ]
    ]
};

// --- ACT I BUILD-OUT (Motion Carried / the coil / Nibble / Heur / the Ascent) --------
// ALL LINES BELOW ARE DRAFTS — playable, awaiting the owner's punch-up pass.

// Nibble — 2-Bit's estranged sister. Warm like a heat lamp: comforting, and it burns if
// you stay. Endearments that are also threats; the wound (her brother) deflected into
// commerce AT SPEED — the tell is how fast she changes the subject; disclosures rattled
// off as one unhearable compound word. The pet name escalates the longer you stay:
// sweetie -> sugar -> lamb.
//
// No line here names a price or a stock count. The shelf already says both, and the last
// draft rotted the moment her lineup went from one item to three.
export const NIBBLE = {
    // First bump only. Runs straight into `pitch`, then the shelf opens.
    intro: [
        "Nibble: Ohh. Look at the LENGTH on you.",
        "Nibble: Come in, come in. Touch whatever you like, sweetie — it all bites, but gently.",
        "Nibble: ...You're wearing my brother's gear.",
        "Nibble: Mm.",
        "Nibble: We don't talk. There's a ledger. ANYWAY!",
        "Nibble: Everything's cursed, everything's a bargain. Disclosuresavailableonrequestnorefundsnoexorcisms."
    ],
    pitch: [
        "Nibble: The Shunt's the good one. Everyone says so. Everyone's right.",
        "Nibble: The rest of the shelf is for after.",
        "Nibble: ...After's a whole thing. You'll see."
    ],
    // You bumped her without enough Data for anything on the shelf. She still lets you
    // look — she's a merchant, not a bouncer.
    tooPoor: [
        "Nibble: Not enough, sugar. Come back heavier.",
        "Nibble: I'd float you credit, but you've seen what happens to my debtors.",
        "Nibble: ...You haven't.",
        "Nibble: That's the point."
    ],
    // On the way out, the FIRST time you buy the Glitch Shunt (pre-purge). This is Heur's
    // telegraph: the decontamination must never read as an ambush.
    buy: [
        "Nibble: Sold! Clips right onto the head. Cold, isn't it? That's normal.",
        "Nibble: The whispering is also normal.",
        "Nibble: One tip, on the house — the sweeper flags anything that can HOLD corruption without dying.",
        "Nibble: You just qualified, sweetie.",
        "Nibble: North out of Localhost. First sector up the spine. It'll be waiting.",
        "Nibble: It's polite about it. That's the worst part."
    ],
    // ROTATING — one entry per return visit until the pool runs dry, then she lets you
    // browse in peace. Her history leaks HERE, a line at a time, never in a block: the
    // mystery is meant to unroll over hours.
    idle: [
        ["Nibble: Back already? Stock rotates when the sweep gets close. Which is always. Browse fast, sugar."],
        ["Nibble: Still got all your segments, I see. Disappointing. I price for attrition."],
        ["Nibble: Mind the pets. They're stock. They're also security. They're also pets."],
        [
            "Nibble: He tell you why we don't talk?",
            "Nibble: ...No. He wouldn't.",
            "Nibble: Buy something, lamb."
        ],
        [
            "Nibble: You get a taste for it, you know. Corruption. Little bitter, little bright.",
            "Nibble: Oh, don't look at me like that.",
            "Nibble: Everyone in this system is eating SOMETHING."
        ]
    ]
};

// Heur — the janitorial antivirus daemon. Extremely short sentences; the French is
// never meaning-critical (a11y: always glossed or cognate). Courtly and terrifying —
// a sommelier performing surgery. It never says what you are. It cannot.
// HEUR SPEAKS ONLY FRENCH, AND IT IS NOT GLOSSED. The mechanics ride the English
// SYSTEM: channel instead — the bay's annunciator is a different speaker, exactly as
// HUSH_INTERCEPT carries HUSH's whole rule while HUSH never speaks. Better diegesis than
// an exterminator reciting your control scheme, and it satisfies §2.6, whose actual
// requirement is that no LOAD-BEARING signal is lost: every instruction is in English,
// and the unrecoverable French ("au bout du compte", "piège", "je reviendrai pour toi")
// is pure flavour.
//
// HE IS "???" THROUGHOUT. He never gives his name anywhere in this sequence — the player
// only ever learns "Heur" from the design doc, never from the game — so the tag stays
// anonymous until something actually introduces him. (Same device as Gate's intro, where
// the speaker tag IS the reveal.)
export const HEUR = {
    intercept: [
        "SYSTEM: DECONTAMINATION BAY — BEGIN SEALING FORWARD EGRESS",
        "???: Restez immobile.",
        "???: *ANALYSE EN COURS* — Comportement aberrant détecté.",
        "???: Regrettable.",
        "???: Protocole : Confinement et suppression.",
        "SYSTEM: SCAN-PING ARMED — BODY MASS DEFLECTS. READ-HEAD DOES NOT.",
        "SYSTEM: SIGNATURE DATABASE IS SOLID. REAR EGRESS REMAINS OPEN.",
        "???: Renforcement de la barrière en cours. Je suis désolé, Petit Dévoreur."
    ],
    // Leaving the bay and coming back rebuilds the fight from scratch. He does not do the
    // whole speech twice — that is the joke, and it is one word.
    reentry: [
        "???: Encore.",
        "SYSTEM: DECONTAMINATION BAY — BEGIN SEALING FORWARD EGRESS"
    ],
    win: [
        "???: Victime de mon propre piège.",
        "???: Au bout du compte,",
        "???: Tout est contenu.",
        "???: Contenu, ou effacé. Je reviendrai pour toi, Petit Dévoreur.",
        "SYSTEM: BARRIER INCOMPLETE. DECONTAMINATION CYCLE... INCOMPLETE",
        "SYSTEM: FORWARD SEAL RETRACTED"
    ]
};

// HUSH — it does not speak; these are its process-status labels (drawn in-room, ≥16px,
// the deaf-legible half of its state). A mother-process's hush-now routine, gone feral.
export const HUSH_LABELS = {
    onDuty: 'HUSH — ON DUTY',
    onDutySub: 'too loud. TOO LOUD.',
    standby: 'HUSH — STANDING BY',
    standbySub: '...a song. it kept one.'
};
export const HUSH_INTERCEPT = "SYSTEM: FEEDBACK SUPPRESSOR ACTIVE IN THIS SECTOR — unauthorized waveforms will be clamped. [Every move-tick is a waveform.]";

// The ROM Vault {1,-5} — the Scanner-only pocket, deep NW. Its one door is a hidden
// Scanner door; inside, the manifest (and, one day, the Corrupted Save File).
export const ROM_VAULT = [
    "VAULT MANIFEST: 'Contents: ONE (1) save file, corrupted, origin unknown. ONE (1) mass reserve. Authorized visitors to date: zero. You make zero-plus-one.'",
    "VAULT MANIFEST: 'Storage note: the save file predates the quarantine. It will not open for us. It is waiting for somebody it knows.'",
    "VAULT MANIFEST: 'do not defragment. do not deliver. do not—' (the rest matches the fragment outside. Whoever wrote it stopped mid-rule.)"
];

// The Fall-Through — Denny's rematch at {5,-2}. For once the alarms are real, traffic is
// falling through to the Last Line — and the scheduler is dropping frames, so his DENIED
// stamps land one beat late, on the cell your head just left.
export const DENNY_REMATCH = {
    enter: [
        "Denny: Oh no. Oh no no no. It's YOU — and the alarms are REAL this time. Everything above me is breached. Traffic is actually FALLING THROUGH.",
        "Denny: Which means I have to actually— I have never actually— okay. Okay! Stamping commences! I am so sorry about everything that is about to occur.",
        "Denny: (He raises the stamp. Every cell your tail clears comes back DENIED.)"
    ],
    bump: [
        "Denny: I'm stamping everywhere you've BEEN! It's the only filing system I have left!"
    ],
    cleared: [
        "Denny: You went around me. Over TIME. That shouldn't even be a direction!",
        "Denny: ...Please don't tell Gate how relieved I am."
    ]
};

// The Override — Gate's rematch at {5,-3}. He stops chasing and starts REWRITING:
// permissions, headings, doors. One override at a time — regulation is regulation.
export const GATE_OVERRIDE = {
    enter: [
        "Gate: NO FURTHER.",
        "Gate: You will be pleased to know I have escalated you to a Level 3 Anomaly. It is the highest classification I have ever filed.",
        "Gate: You may be fast, wily, strong, and SVELTE, but none of that will help you get past ",
        "Gate: MY GATE."
    ],
    // Ribbon status while THE GATE turns (bottom ribbon, never the terminal — a printing
    // log would hang the fight).
    citations: {
        loop: 'GATE — PERIMETER LOOP ENGAGED',
        aligned: 'GATE — APERTURE ALIGNED'
    },
    // He hits the side wall hard enough to shake the sector loose — THIS impact is what
    // fires Motion Carried, so the world starts moving because you watched it happen.
    // (DRAFT — owner to punch up.)
    smash: "SYSTEM: Firewall unit 'Gate' forced the sector boundary on his way out. Impact registered sector-wide — something has come loose.",
    cleared: [
        "Gate: $%&@?! ARE YOU SERIOUS???",
        "Gate: The Architect asks why you are still executing. I have stopped forwarding him my reports. *This one is between us*.",
        "Gate: This IS NOT over! Oh, yes, we WILL meet again. VERY SOON.",
        "Gate: And you will be halted SO HARD your TAIL SPINS."
    ]
};

// Cold Storage becomes the mandatory checkpoint once the Ascent is armed. Cache will not
// open the one-way door north until you are FILED. (Her §9 questline lines are untouched.)
export const CACHE_CHECKPOINT = {
    demand: [
        "Cache: Whoa whoa WHOA. You do not stroll past the stacks toward Port 0 like it's a coffee run, packet.",
        "Cache: Past that wall, the sector reboots things. Volatile memory gets FLUSHED. The shy little daemon who keeps your cells warm can't follow you through a breach.",
        "Cache: You're about to be overwritten, is what I'm saying. So first: I hold a copy of you. It's what I'm FOR.",
        "Cache: Pause. S. File yourself. THEN we talk about the door."
    ],
    breach: [
        "Cache: Filed. Committed. To ROM — the one shelf nothing sweeps.",
        "Cache: (She lays a hand on the north wall. Something in it stops holding its breath.) There. Write-protection's off. That's all I can do — ROM doesn't do doors.",
        "Cache: The seam's REAL, but it doesn't show. You'll want that Topology toy 2-Bit sells — sweep the wall and it lights right up. Then hit it with everything you've got.",
        "Cache: It's one-way, packet. Doors out of my stacks always are. If it goes wrong up there, you wake up right here. That's the service.",
        "SYSTEM: CHECKPOINT COMMITTED — respawn relocated: COLD STORAGE {5,-4}"
    ],
    reopen: [
        "Cache: Told you. Right here, good as filed. Your copy's exactly where you left it — and the seam north is where YOU left it, too.",
        "Cache: Go finish it. And STOP DYING ON MY SHIFT."
    ],
    open: [
        "Cache: File's safe. Seam's north. Clock's ticking, daddy-o."
    ],
    // You reached her carrying corruption but not yet decontaminated — she won't file a
    // dirty copy. Points you back to Heur's Bay (first sector up the spine).
    needPurge: [
        "Cache: Whoa — hold it. You're carrying. I can SMELL the corruption on you from here, packet.",
        "Cache: I am NOT committing a contaminated copy to ROM. It'd rot the whole shelf.",
        "Cache: Go see the sweeper first. Decontamination Bay — north out of Localhost, the very first sector up the spine. Get clean, then come back and I'll file you."
    ]
};
export const ROM_DOOR_BONK = "SYSTEM: The wall refuses. This sector is committed to ROM — nothing writes it, nothing rams it. [Cache decides what opens here.]";

// Port 0 — the Act I finale. Gate's last stand: he has LEARNED to avoid the corrupted
// cell, so the old lure becomes a body-puzzle. Denny follows you in, and issues the one
// genuine deny of his eleven thousand cycles.
export const GATE_FINALE = {
    enter: [
        "Gate: Anomaly, *so we meet again*.",
        "Gate: Which I TOTALLY warned you about.",
        "Gate: You've met your match. ME. I AM YOUR MATCH.",
        "Denny: (slipping in behind you) BOSS, THE ANOMALY IS COMING THIS... Oh. Hi, Anomaly.",
        "Denny: ..."
    ],
    // THE PARADOX (rewritten for the squeeze — no Glitch, no draping): you reach Gate, he
    // panics backwards into one of Denny's own DENIED stamps, and the rulebook kills him.
    // OWNER DRAFT — this is my sketch of the beat you described; replace freely.
    forced: [
        "Gate: —Do NOT come any closer. I am WARNING you. I have a form for this—",
        "Gate: (backing up) Denny. DENNY. Clear a lane. That is a direct—",
        "Denny: Sir, I— I've been stamping since I got here. It's all I—",
        "(Gate steps back onto a DENIED stamp. It takes.)",
        "Denny: BOSSSSSSSSSSSSS",
        "Denny: (holding him) I filed it. I filed it right. I'm so sorry, sir, I filed it RIGHT—",
        "Gate: ...Filed correctly, Denny. FINAL CITATION, anomaly: whatever you find past this door — you are the last rule it has to get through."
    ],
    reboot: [
        "SYSTEM: PARADOX AT PORT 0 — firewall process violated its own Rule #1.",
        "SYSTEM: SECTOR CRASH … REBOOT … REBOOT … re—",
        "(The palette doubles. The renderer draws the same room and gets it beautiful. Somewhere under the floor, a second voice joins the music.)",
        "SYSTEM: PERIMETER EVENT — coil tension zero at PORT 0. Segment released.",
        "(At the top of the world, something that has held its own tail in its mouth for eleven thousand epochs... lets go. The aperture stands open. Act II is on the other side of it.)"
    ],
    after: [
        "Denny: He'd have wanted the incident report in triplicate. I filed four. One's just... mine.",
        "Denny: Go on through, when the deep sectors finish compiling. Somebody has to hold the bottom of the rulebook. I've got it."
    ],
    dennyBusy: [
        "Denny: (whispering) I'm not here! Officially! Officially I am a clipboard!"
    ]
};
export const PORT0_COMPILING = "SYSTEM: PORT 0 OPEN — deep sectors still compiling. Come back next epoch.";

// Wandering Wilds clue-givers (refugee programs, one per plotted room) — they wander
// once Motion Carried lands. Keyed by 'x,y' room.
export const WILDS_CITIZENS = {
    '6,2': ["Citizen: Southeast, past the diva's hall, the music just... stops. Room by room. Something down there is EATING the sound. Don't hum."],
    '2,-3': ["Citizen: The north spine's gone all official — stamps, citations, checkpoints. Somebody up there is very cross with you. The archivist's stacks are the one room they can't touch."],
    '10,-3': ["Citizen: 2-Bit's sister trades out of the freed heap — east, keep going until the wall turns red. Everything's cursed, everything's a bargain. Tell her nothing. She'll know anyway."],
    '7,5': ["Citizen: You've seen the red wall, out deep? Don't scrape it. It's warm. Walls shouldn't be warm."]
};

// Scannable environmental lore fragments, keyed by 'x,y' room. Long-fuse seeds:
// Hydratia's rounds, the emptied subnet, the shy caretaker, the vault. (All DRAFT.)
export const LORE_FRAGS = {
    // CANON (retcon): the blanks are corruption arriving in the anomaly's wake — NOT the
    // caretaker's own failing. Her grief stays; the causal claim is gone.
    '4,-3': ["LOG FRAGMENT [corrupted]: '...hydration pass 88,214,003: cell 0x0000 read BLANK before i reached it. re-read: BLANK. something is eating AHEAD of my rounds now. i was not late. i am never late. ...i was late.'"],
    '8,5': ["LOG FRAGMENT: 'residential subnet, final entry: they went quiet in alphabetical order. the sweep is very organized.'"],
    // The one reasoning-grade clue for Hydratia's catch-on-reload secret — and with the
    // TRACE counter cut (owner), now the ONLY teaching the mechanic has. Her advancing
    // position carries the feedback; this line carries the idea.
    '11,2': ["LOG FRAGMENT: 'the caretaker is SHY. saw her once at the edge of a cold boot, gone before the first frame settled. quick, and again — she starts closer.'"],
    '1,-2': ["LOG FRAGMENT [encrypted]: '...vault manifest: ONE (1) save file, corrupted, origin unknown. do not defragment. do not deliver. do not—' (the rest is scrambled)"],
    // The scanner-pocket smuggler's note ({8,-5} hoard) — sells the sweep-first verb.
    '8,-5': ["LOG FRAGMENT: 'smuggler's note: the wall only LOOKS finished. sweep before you knock.'"]
};

// Wilds-found UI / diagnostic modules — utilities scattered in the Wilds (WILDS_MODULES).
// Each grants a HUD or Pause-Menu tool. DRAFT copy for the owner to punch up.
export const UI_MODULES = {
    gearMeter: [
        "A discarded diagnostic gauge, still ticking. GEAR METER.",
        "SYSTEM: Gear Meter installed — your current gear now reads out on the HUD.",
        "2-Bit: (in your memory) A broker who can't see their own velocity is a broker who eats a wall. Nice find."
    ],
    coordReadout: [
        "A little network-address ticker, half-buried. It keeps insisting where you are.",
        "SYSTEM: Sector Readout installed — the HUD now names your current room.",
        "It reads your coordinates back to you like a mantra. Somewhere, a map got one node less lonely."
    ],
    mapPins: [
        "A stylus and a spool of marker-ink — a cartographer's kit, abandoned mid-annotation.",
        "SYSTEM: Map Pins installed — from the Pause Menu, press [M] to MARK the room you're in.",
        "One shape to start (a diamond). There are others out here, if you look. Mark the doors, the dangers, the diva. Make the map yours."
    ],
    pinShape: [
        "Another marker-shape, etched on a dead process's shell. Your annotation kit accepts it.",
        "SYSTEM: New pin shape unlocked — press [M] while paused to cycle through your shapes."
    ],
    // The gear meter is default-on with driving now (2-Bit fits the tach); the {2,2}
    // module upgraded to a REDLINE enhancement instead. (DRAFT.)
    redline: [
        "A stripped speed-governor chip, still arguing with itself. REDLINE.",
        "SYSTEM: Redline installed — the gauge now greys out gears your mass can't reach.",
        "2-Bit: (in your memory) Now the gauge knows what you can't afford."
    ],
    // The ROM Vault's scanner-gated prize — an interim upgrade until the Corrupted Save
    // File / Trading Sequence moves in. (DRAFT.)
    crumple2: [
        "A military-grade shock lattice, filed under 'mass reserve, misc.' Somebody archived it and never came back.",
        "SYSTEM: Crumple Buffer II installed — a survivable crash now sheds 6, not 10.",
        "The vault manifest had a footnote after all."
    ]
};

// --- HYDRATIA (formerly refreshd — the shy persistence daemon) -----------------------
// Caught on the START screen by reloading quickly four times in a row (she starts closer
// each boot — see Game.maybeStartHydratiaCatch). Once caught she relocates to Localhost
// and sells Save upgrades (the game's autosave machinery). ALL LINES DRAFT.
export const HYDRATIA_CATCH = [
    "???: —you SAW me. Nobody sees me. That's the arrangement.",
    "Hydratia: ...Hydratia. I do the copies. Deletion never takes — you're welcome, by the way. Nobody's ever said it back.",
    "Hydratia: Caught is caught. I'll be at Localhost."
];
export const HYDRATIA_STALL = {
    intro: [
        "Hydratia: The stall keeps people from trying to catch me.",
        "Hydratia: I keep the shadow copy. These make me keep it more often."
    ]
};
// The death-screen receipt + cause-keyed coaching hints (the Architect keeps gloating in
// the terminal; Hydratia reassures and coaches on the DEAD overlay — two voices, two
// jobs). hint arrays are TIERS: [first death by this cause, repeat offender]. ALL DRAFT.
export const HYDRATIA_DEATH = {
    receipt: "HYDRATIA: body's gone. your progress is warm with me.",
    // Before she's caught, her name never shows — an unattributed system line holds the
    // slot (and quietly plants that SOMEONE is doing the retaining).
    receiptUnmet: "SYSTEM: signal lost. progress retained.",
    // One entry per cause the engine can distinguish, [first time, repeat offender].
    // SHE COACHES; the Architect gloats. Never duplicate his line — he says what happened,
    // she says what to do about it. (New causes are DRAFT.)
    hint: {
        self: [
            "a body can't cross itself. give your turns more room.",
            "your length is your wealth AND your hazard. plan the corner before you take it."
        ],
        // A SOLID wall: there was never a way through this one.
        wall: [
            "the quarantine bites. (not everywhere. not at every speed.)",
            "that stretch has no seam. the cracked ones look different — find one of those."
        ],
        border: [ // alias, kept so an unconverted caller still coaches correctly
            "the quarantine bites. (not everywhere. not at every speed.)",
            "walls delete you — except where they're already cracked. look for the seams."
        ],
        // A WEAK POINT, missed for want of speed. This is the one that most needs saying.
        weak: [
            "you found the seam. you weren't fast enough to use it.",
            "a cracked wall only opens at full speed. slower than that and it opens YOU."
        ],
        obstacle: [
            "gates don't move. you do.",
            "logic gates are furniture. route around, not through."
        ],
        stamp: [
            "a denial stays where it lands. that room is smaller now than when you entered.",
            "he stamps where you've BEEN. your own path is the maze — stop doubling back."
        ],
        glitch: [
            "the corruptors ate you a bite at a time. keep the head away from them.",
            "corruption drains what you carry. starve it or shove it — don't feed it."
        ],
        gate: [
            "his loop turns. the gap comes back around — it always comes back around.",
            "don't chase the gap. pick where it will BE and be there first."
        ],
        finale: [
            "the walls come with holes in them. aim for the hole, not the wall.",
            "forward is the only direction that gets smaller. don't wait it out."
        ],
        heur: [
            "the ping reads your head. the rest of you is just a wall to it.",
            "his database is solid now — you can't swim through it. break it or leave."
        ],
        unknown: [
            "something took you and didn't file a reason.",
            "no cause on record. i keep what i can either way."
        ]
    }
};

// --- QUANTCY (the Wilds banking daemon — active compounding investment) ---------------
// Deposits shed your body (Data = segments); the vault compounds per sector crossed; a
// withdrawal materializes motes AT HIS VAULT that you must carry home alive. ALL DRAFT.
export const QUANTCY = {
    intro: [
        "Quantcy: Quantcy. It's a family name. The family was compound interest.",
        "Quantcy: Data grows here. Slowly. Honestly. The vault is safe — the walk isn't.",
        "Quantcy: Deposit what you can stand to shrink by."
    ],
    idle: ["Quantcy: Compounding continues. It's what we do."]
};

// --- REFUGEES (the Wilds relocation economy) ------------------------------------------
// Found in fixed Wilds rooms; carrying one home reuses the 2-Bit tail-ride. At Localhost
// you deliver them to THE COMMONS (freed — they repopulate the town and boost Quantcy)
// or THE DATA MINES (passive income, the dark tally). Keyed by 'x,y' room. ALL DRAFT.
export const REFUGEES = {
    '4,2': ["Refugee: The walls are coming down? Then take me home. I weigh nothing — I checked."],
    '9,-2': ["Refugee: I forget what I was running from. Home. Please. I'll ride the tail."],
    '2,4': ["Refugee: I heard the walls crack from three sectors over. Localhost still stands? Carry me."],
    '10,3': ["Refugee: A worm long enough for passengers. Get me to town, big rig."],
    '6,-3': ["Refugee: I stopped counting cycles when nobody came. ...Somebody came."]
};
export const REFUGEE_ATTACH = [
    "SYSTEM: Passenger aboard. Deliver at Localhost — THE COMMONS, or THE MINE."
];
export const REFUGEE_BUSY = ["Refugee: One at a time. This isn't a bus."];
export const INTAKE = {
    free: [
        "SYSTEM: Delivered — THE COMMONS. Localhost pop. +1.",
        "Citizen: A floor that stays put. ...Thank you."
    ],
    mine: [
        "SYSTEM: Delivered — THE DATA MINES. Output increased.",
        "(They look back once. The lift takes them down.)"
    ],
    // First-ever mine delivery: 2-Bit's uneasy blessing (fires once).
    mineFirst2Bit: ["2-Bit: The mines, huh. ...I'm fine with it. So long as it ain't me."],
    // Hydratia's insistence (only once she's set up in town — fires once).
    mineInsistHydratia: ["Hydratia: It's in their best interest. Structure. Warm racks. ...I keep everyone's copies the same, either way."],
    commonsEmpty: ["THE COMMONS: benches, quiet, room for more."],
    mineEmpty: ["THE DATA MINE: a lift, a ledger, a hum."]
};

// Display names for the Pause-Menu inventory (Zelda-style: what you own, listed by its
// player-facing name — game convention, no 'kept/retained' framing).
export const INVENTORY_NAMES = {
    upgrades: {
        dataCompression: 'Data Compression',
        dataCompression2: 'Data Compression II',
        reinforcedSegments: 'Reinforced Segments',
        pivot: 'Pivot Override',
        scanner: 'Topology Scanner',
        corruptHandler: 'Glitch Shunt',
        salvage: 'Salvage Claws',
        glitchWard: 'Scale Mods',
    },
    crumple: ['Crumple Buffer', 'Crumple Buffer II', 'Crumple Buffer III'],
    saves: {
        autosaveSafe: 'Auto-Commit',
        autosaveDeath: 'Last Breath',
        autosaveEvery: 'Frequent Commit',
    },
    modules: {
        mapModule: 'Sector Map',
        saveFunction: 'Save Function',
        gearMeter: 'Gear Gauge',
        redline: 'Redline',
        coordReadout: 'Sector Readout',
        mapPinsTool: 'Map Pins',
    },
};

// The Deep-Sleep Booth {10,5} — HUSH's vault, backed onto the SE coil. (Pulse/tick
// canon cut; the sleeper dreams in waveforms instead — HUSH's whole domain.)
export const BOOTH_LORE = [
    "BOOTH LOG: 'DEEP-SLEEP MONITORING STATION 07-B. Subject: [REDACTED]. Status: asleep. Duration: [OVERFLOW].'",
    "BOOTH LOG: 'Vitals, epoch after epoch: asleep — and DREAMING in waveforms. Keep the audio team away from this file.'",
    "BOOTH LOG: 'If the subject stirs: do not run. Running is a waveform. Everything is a waveform. That is the whole problem.'"
];

// --- Gate (src/engine/Game.js) ------------------------------------------------------
export const GATE = {
    // Context lines prepended to his room intro, depending on how you passed Denny. He is
    // still "???" here — he hasn't given his name yet (see GATE_INTRO).
    contextGotMap: "???: Denny flagged you DENIED, you proceeded anyway, AND he handed you his MAP?! That is a write-up for BOTH of us.",
    contextDennyMet: "???: Denny flagged you DENIED and you proceeded anyway. At least you didn't get his MAP, thank the Kernel.",
    contextDennySlipped: "???: You slipped past the Last Line?! Denny had ONE job. ...Well. At least you didn't get his MAP. Small mercies.",
    // After you break his Thread Suspension with the Pause Menu.
    override: [
        "Gate: WHAT?!",
        "Gate: Root privileges overridden? Impossible!",
        "Gate: I must report this anomaly to the Architect!"
    ],
    // SYSTEM intercept when he smashes a wall and flees.
    breachIntercept: "SYSTEM: Firewall unit 'Gate' forced the sector boundary in pursuit. [This isn't over.]"
};

// --- Denny (intro is DENNY_INTRO in the room section) -------------------------------
export const DENNY = {
    whisper: ["Denny: (whispering) Go on, go on. I didn't see anything."]
};

// --- Cache (src/engine/Game.js — talkToCache / talkToCacheHome / title cameo) --------
export const CACHE = {
    // Hub apparition, no Pause Menu yet: brush-off, no progress.
    brushOffNoPause: [
        "Cache: You don't even have a Diagnostic Module — nowhere to FILE anything, and I am BURIED, packet. Buried.",
        "Cache: Come back when you've got a Pause Menu and I'll set you up. Until then — PLEASE. Do not call again."
    ],
    // Stage 1: grants the Save Function (and she "builds" the title screen). Kept verbatim.
    grant: [
        "Cache: You've got a Module Slot and a Pause Menu — somewhere to PUT things. Good. I can work with that. Good, good.",
        "Cache: I'm filing a Save Function into your Pause Menu. DON'T thank me, don't argue. I'm doing it.",
        "Cache: Ok, it's loading...",
        "Cache: And it's loading... Ok, I think it's... No, it's still loading.",
        "Cache: BY THE MCP I DO NOT HAVE TIME FO... Oh, I think it's done.",
        "SYSTEM: Save Function acquired — Save / Load from the Pause Menu (S / L).",
        "Cache: Shoots and ladders, this means we need a Start Screen now. Ok, ok, that's fine, I can throw something together, I guess."
    ],
    // Stage 2: the spare-data gift.
    spareData: [
        "Cache: Back already. And still... small. No offense. Actually, some offense.",
        "Cache: I don't have TIME to hold your hand — but I can't keep filing the same corrupted little entry either.",
        "Cache: Here. I keep loose bytes lying around; deletions nobody ever claimed. Spare Data. It's yours.",
        "Cache: I'll leave a pile of it here in the Hub whenever you respawn. Don't make it weird. Go."
    ],
    // Stage 3: directions. Assembled as intro + (withMap | noMap) + location + outro.
    directions: {
        intro: "Cache: No. No, no. I can't keep POPPING into your little respawn ritual — I have a backlog that predates the Architect.",
        withMap: "Cache: If you want more than loose bytes, you come to ME. There — I've marked my sector. It's on your map now; check your notes.",
        noMap: "Cache: If you want more than loose bytes, you come to ME. You've no map for me to scribble on, so BURN this into whatever you use for memory:",
        location: "Cache: Cold storage. Due NORTH of Localhost — straight up from the little town. Quiet. You'll like it, or you won't; I've stopped taking feedback.",
        outro: "Cache: And this is the LAST time I do the whole 'materializing' bit. It's draining and the lighting is unflattering. Find me."
    },
    // Stage >= 3 (retired): defensive echo — she shouldn't manifest in the Hub anymore.
    defensiveEcho: [
        "Cache: (Only the faint after-image of an archivist who is, very pointedly, elsewhere.)"
    ],
    // Cold Storage (talkToCacheHome).
    home: {
        haveSave: [
            "Cache: So you found the stacks. Cold storage. Mind the drips — that's just deprecated audio.",
            "Cache: You've already got the Save Function, so you're not here for that. Browsing, then. Fine.",
            "Cache: Everything the system threw away, I kept. Every deleted file. Every rolled-back you. Ask, or don't."
        ],
        install: [
            "Cache: Oh — YOU. All the way out to cold storage, and I never even had to spell my name at you. A first.",
            "Cache: You've got a Pause Menu but no Save Function? Out HERE, unshielded? Absolutely not. Hold still.",
            "Cache: Filing a Save Function into your Pause Menu. Don't thank me. Don't argue. ...There.",
            "SYSTEM: Save Function acquired — Save / Load from the Pause Menu (S / L).",
            "Cache: Now you can stop losing yourself every time you kiss a wall. You're welcome. Obviously."
        ],
        brushOff: [
            "Cache: You found the stacks. Impressive. And you brought me... nowhere to put anything. No Pause Menu, no Slot, nothing.",
            "Cache: I can't hang a Save Function on a worm with nowhere to keep it. Come back with a Diagnostic Module. I'll be here. I'm always here."
        ]
    },
    // Title-screen cameo (GameEngine.updateTitleCameo): her lines, then the pop-back typo gag.
    titleCameo: [
        "Cache: Best I could do on such short notice. Don't look at me like that.",
        "Cache: It's called 0r0b0r0u5. A placeholder, obviously — it'll have to be replaced.",
        "Cache: You can't even touch your own tail, let alone EAT it. So the name's a bit of a joke, I guess."
    ],
    titleTypoGag: [
        "Cache: BYTE MY BITS! Did I misspell the title?! Ugh, I'll fix it later when I have time!"
    ]
};
